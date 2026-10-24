"""Tests LigdiCash — payin avec redirection (initiation, callback re-vérifié, liens unique).

L'API LigdiCash est TOUJOURS mockée ici (aucun appel réseau) : on teste la
logique métier — idempotence, re-vérification, contrôle du montant, liens
publics signés.
"""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.clients.models import Client
from apps.finance.models import Invoice, InvoiceLigne, Receipt
from apps.ligdicash.models import CallbackLigdiCash, PayinTransaction
from apps.ligdicash import services
from apps.ligdicash.services import construire_payload_facture, extraire_transaction_id
from apps.ligdicash.signing import signer_facture

REPONSE_CREATE = {
    "response_code": "00",
    "token": "TOKEN-CREATION",
    "response_text": "https://app.ligdicash.com/pay/invoice/TOKEN-CREATION",
    "wiki": "https://client.ligdicash.com/wiki/createInvoice",
}

CONFIRM_COMPLETED = {
    "response_code": "00",
    "status": "completed",
    "operator_name": "ORANGE BURKINA",
    "customer": "22676275726",
    "montant": 10000,
    "amount": 10000,
    "oreference": "OP-123",
    "request_id": "P2777636082026",
    "custom_data": [{"keyof_customdata": "transaction_id", "valueof_customdata": "PAI-X"}],
}

CONFIRM_PENDING = {
    "response_code": "00",
    "status": "pending",
    "montant": 10000,
    "amount": 10000,
    "customer": None,
    "operator_name": "",
}


def _api_faux(confirm=None):
    """Fausse API : création OK, /confirm renvoie le dict fourni."""
    def faux(chemin, methode="GET", payload=None, params=None):
        if chemin.endswith("/create"):
            return dict(REPONSE_CREATE)
        return dict(confirm or CONFIRM_PENDING)
    return faux


@override_settings(LIGDICASH_ENABLED=True, PAYMENT_ENABLED=True, FRONTEND_URL="https://hub.digicom.ml",
                   LIGDICASH_VERIF_PAGE=False)
class LigdiCashTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(
            nom_societe="Orange Mali", contact="Amadou Diallo", email="amadou@exemple.com")
        self.facture = Invoice.objects.create(client=self.client_obj, statut=Invoice.STATUT_ENVOYEE)
        InvoiceLigne.objects.create(invoice=self.facture, description="Formation", quantite=2, montant=5000)
        self.user = User.objects.create_user(
            username="client", email="client@exemple.com", password="x", role="client", client=self.client_obj)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    # --- Initiation ---------------------------------------------------

    def test_initier_fige_le_montant_et_renvoie_le_pay_url(self):
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux()):
            r = self.api.post("/api/v1/finance/paiements/ligdicash/initier/",
                              {"facture_id": self.facture.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["pay_url"].startswith("https://app.ligdicash.com/pay/invoice/"))
        transaction = PayinTransaction.objects.get(transaction_id=r.data["transaction_id"])
        self.assertEqual(transaction.montant, 10000)  # 2 x 5000, figé
        self.assertEqual(transaction.ligdicash_token, "TOKEN-CREATION")
        self.assertEqual(transaction.statut, PayinTransaction.STATUT_PENDING)

    def test_client_ne_peut_payer_une_facture_d_autrui(self):
        autre = Client.objects.create(nom_societe="Autre SA")
        facture = Invoice.objects.create(client=autre, statut=Invoice.STATUT_ENVOYEE)
        InvoiceLigne.objects.create(invoice=facture, description="Presta", quantite=1, montant=1000)
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux()):
            r = self.api.post("/api/v1/finance/paiements/ligdicash/initier/",
                              {"facture_id": facture.id}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_payload_customer_vide_et_total_entier(self):
        payload = construire_payload_facture(self.facture, "PAI-TEST-0001", self.facture.solde)
        facture = payload["commande"]["invoice"]
        self.assertEqual(facture["customer"], "")  # sinon LigdiCash masque les opérateurs
        self.assertEqual(facture["otp"], "")
        self.assertEqual(facture["devise"], "XOF")
        self.assertIsInstance(facture["total_amount"], int)
        self.assertEqual(facture["total_amount"], 10000)
        self.assertEqual(sum(i["total_price"] for i in facture["items"]), facture["total_amount"])
        self.assertEqual(payload["commande"]["custom_data"]["transaction_id"], "PAI-TEST-0001")
        self.assertIn("sig=", payload["commande"]["actions"]["return_url"])

    def test_initier_lien_exige_une_signature_valide(self):
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux()):
            r = self.api.post("/api/v1/finance/paiements/ligdicash/initier-lien/",
                              {"facture": self.facture.numero, "sig": "mauvaise"}, format="json")
            self.assertEqual(r.status_code, 403)
            r = self.api.post("/api/v1/finance/paiements/ligdicash/initier-lien/",
                              {"facture": self.facture.numero, "sig": signer_facture(self.facture.numero)},
                              format="json")
        self.assertEqual(r.status_code, 201)

    # --- Callback -----------------------------------------------------

    def _transaction(self):
        transaction = PayinTransaction.objects.create(
            invoice=self.facture, montant=10000, ligdicash_token="TOKEN-CREATION")
        return transaction

    def _callback(self, transaction, statut="completed", montant=10000):
        payload = {
            "status": statut,
            "amount": montant,
            "montant": montant,
            "custom_data": [
                {"keyof_customdata": "transaction_id", "valueof_customdata": transaction.transaction_id},
                {"keyof_customdata": "logfile", "valueof_customdata": "LOG"},
            ],
            "external_id": transaction.transaction_id,
        }
        return self.api.post("/api/v1/finance/paiements/ligdicash/callback/", payload, format="json")

    def test_callback_completed_encaisse_et_solde_la_facture(self):
        transaction = self._transaction()
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux(CONFIRM_COMPLETED)):
            r = self._callback(transaction)
        self.assertEqual(r.status_code, 200)
        transaction.refresh_from_db()
        self.assertEqual(transaction.statut, PayinTransaction.STATUT_COMPLETED)
        self.assertEqual(transaction.operator_name, "ORANGE BURKINA")
        recu = Receipt.objects.get(ref_transaction=transaction.transaction_id)
        self.assertEqual(recu.moyen, Receipt.MOYEN_MOBILE_MONEY)
        self.assertEqual(float(recu.montant), 10000.0)
        self.assertEqual(Invoice.objects.get(id=self.facture.id).statut, Invoice.STATUT_PAYEE)

    def test_callback_ne_croit_pas_le_payload(self):
        """Le payload dit « completed » mais /confirm dit « pending » : rien n'est honoré."""
        transaction = self._transaction()
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux(CONFIRM_PENDING)):
            r = self._callback(transaction, statut="completed")
        self.assertEqual(r.status_code, 200)
        transaction.refresh_from_db()
        self.assertEqual(transaction.statut, PayinTransaction.STATUT_PENDING)
        self.assertEqual(Receipt.objects.count(), 0)
        self.assertEqual(Invoice.objects.get(id=self.facture.id).statut, Invoice.STATUT_ENVOYEE)

    def test_callback_doublon_ignore(self):
        """LigdiCash poste 2 fois : un seul reçu."""
        transaction = self._transaction()
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux(CONFIRM_COMPLETED)):
            self._callback(transaction)
            r = self._callback(transaction)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Receipt.objects.count(), 1)

    def test_callback_form_urlencoded(self):
        """LigdiCash poste aussi en application/x-www-form-urlencoded."""
        import json
        from urllib.parse import urlencode

        from django.test import Client as DjangoClient

        transaction = self._transaction()
        corps = urlencode({
            "status": "completed",
            "external_id": transaction.transaction_id,
            "custom_data": json.dumps([
                {"keyof_customdata": "transaction_id",
                 "valueof_customdata": transaction.transaction_id}]),
        })
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux(CONFIRM_COMPLETED)):
            r = DjangoClient().generic(
                "POST", "/api/v1/finance/paiements/ligdicash/callback/", corps,
                content_type="application/x-www-form-urlencoded")
        self.assertEqual(r.status_code, 200)
        transaction.refresh_from_db()
        self.assertEqual(transaction.statut, PayinTransaction.STATUT_COMPLETED)

    def test_callback_transaction_inconnue_repond_200_et_est_journalise(self):
        """Un callback sans transaction connue ne doit PAS faire 4xx : LigdiCash
        retryerait et la validation de l'integration echouerait. Il est
        journalise pour la tracabilite demandee."""
        r = self.api.post("/api/v1/finance/paiements/ligdicash/callback/",
                          {"status": "completed", "amount": 10,
                           "custom_data": {"transaction_id": "INCONNUE"}}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("inconnue", r.data["detail"].lower())
        journal = CallbackLigdiCash.objects.first()
        self.assertIsNotNone(journal)
        self.assertEqual(journal.transaction_id, "INCONNUE")
        self.assertIn("INCONNUE", journal.corps_brut)
        self.assertEqual(journal.statut_reponse, "200")

    def test_callback_sonde_sans_transaction_est_journalise(self):
        """Sonde sans transaction_id : journalise, reponse 200."""
        r = self.api.post("/api/v1/finance/paiements/ligdicash/callback/",
                          {"probe": "phase1"}, format="json")
        self.assertEqual(r.status_code, 200)
        journal = CallbackLigdiCash.objects.first()
        self.assertIsNotNone(journal)
        self.assertEqual(journal.transaction_id, "")
        self.assertIn("phase1", journal.corps_brut)

    def test_callback_form_urlencoded_journalise_le_corps_brut(self):
        import json as _json
        from urllib.parse import urlencode

        from django.test import Client as DjangoClient

        corps = urlencode({"status": "completed", "external_id": "PAI-INCONNUE",
                           "custom_data": _json.dumps([{"keyof_customdata": "transaction_id",
                                                        "valueof_customdata": "PAI-INCONNUE"}])})
        r = DjangoClient().generic(
            "POST", "/api/v1/finance/paiements/ligdicash/callback/", corps,
            content_type="application/x-www-form-urlencoded")
        self.assertEqual(r.status_code, 200)
        journal = CallbackLigdiCash.objects.first()
        self.assertEqual(journal.content_type, "application/x-www-form-urlencoded")
        self.assertIn("PAI-INCONNUE", journal.corps_brut)
        self.assertEqual(journal.transaction_id, "PAI-INCONNUE")

    def test_montant_divergent_non_encaisse(self):
        """Le montant payé <> montant figé : on n'encaisse pas, on signale."""
        transaction = self._transaction()
        confirme = dict(CONFIRM_COMPLETED, montant=999, amount=999)
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux(confirme)):
            self._callback(transaction, montant=999)
        transaction.refresh_from_db()
        self.assertEqual(Receipt.objects.count(), 0)
        self.assertIn("999", transaction.erreur)

    def test_extraire_transaction_id_accepte_les_trois_formes(self):
        self.assertEqual(extraire_transaction_id(
            {"custom_data": [{"keyof_customdata": "transaction_id", "valueof_customdata": "PAI-1"}]}), "PAI-1")
        self.assertEqual(extraire_transaction_id({"custom_data": {"transaction_id": "PAI-2"}}), "PAI-2")
        self.assertEqual(extraire_transaction_id({"custom_data": '{"transaction_id": "PAI-3"}'}), "PAI-3")
        self.assertEqual(extraire_transaction_id({"external_id": "PAI-4"}), "PAI-4")
        self.assertIsNone(extraire_transaction_id({}))

    # --- Vérification de la page de paiement ----------------------------

    def test_page_paiement_404_declenche_un_retry(self):
        """LigdiCash sert une 404 sur la page : on ne renvoie pas le client
        vers une page morte, on recrée une facture et on le signale."""
        from apps.ligdicash.services import LigdiCashError

        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux()), \
                patch("apps.ligdicash.services.page_paiement_valide", return_value=False):
            with self.assertRaises(LigdiCashError) as ctx:
                services.initier_paiement(self.facture)
        self.assertEqual(ctx.exception.code, "page_paiement_404")
        # les transactions créées sont marquées mortes (aucune page servie)
        self.assertEqual(PayinTransaction.objects.filter(
            statut=PayinTransaction.STATUT_NOTCOMPLETED).count(), 2)
        self.assertEqual(PayinTransaction.objects.filter(
            statut=PayinTransaction.STATUT_PENDING).count(), 0)

    def test_page_paiement_valide_ne_reutilise_pas_une_url_morte(self):
        """Une tentative en cours dont la page est morte est abandonnée."""
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux()), \
                patch("apps.ligdicash.services.page_paiement_valide", side_effect=[False, True]):
            transaction, pay_url = services.initier_paiement(self.facture)
        self.assertTrue(pay_url)
        self.assertEqual(transaction.statut, PayinTransaction.STATUT_PENDING)

    @override_settings(LIGDICASH_VERIF_PAGE=True)
    def test_page_paiement_valide_detecte_la_404(self):
        """Signature de la page 404 LigdiCash -> URL considérée invalide."""
        from apps.ligdicash.services import page_paiement_valide

        with patch("apps.ligdicash.services.urlopen") as faux:
            faux.return_value.__enter__.return_value.read.return_value = (
                b"<html><body>404 L&#039;URL que vous tentez de joindre semble etre incorrecte.</body></html>")
            self.assertFalse(page_paiement_valide("https://client.ligdicash.com/directpayment/invoice/X"))
        with patch("apps.ligdicash.services.urlopen") as faux:
            faux.return_value.__enter__.return_value.read.return_value = (
                b"<html><body>LigdiCash | Invoice Transaction ID : P2816497251132</body></html>")
            self.assertTrue(page_paiement_valide("https://client.ligdicash.com/directpayment/invoice/X"))

    # --- Liens publics (QR facture / QR reçu) --------------------------

    def test_lien_paiement_facture_unique_et_signe(self):
        from apps.ligdicash.liens import lien_paiement_facture

        lien = lien_paiement_facture(self.facture.numero)
        self.assertIn(self.facture.numero, lien)
        self.assertIn("sig=", lien)
        self.assertEqual(lien, lien_paiement_facture(self.facture.numero))  # stable
        # Signature d'une facture refusée sur l'endpoint de reçu
        r = self.api.get(f"/api/v1/finance/paiements/ligdicash/recu/{self.facture.numero}/"
                         f"?sig={signer_facture(self.facture.numero)}")
        self.assertEqual(r.status_code, 403)

    def test_page_paiement_publique_refuse_un_lien_non_signe(self):
        r = self.api.get(f"/api/v1/finance/paiements/ligdicash/facture/{self.facture.numero}/")
        self.assertEqual(r.status_code, 403)
        r = self.api.get(f"/api/v1/finance/paiements/ligdicash/facture/{self.facture.numero}/"
                         f"?sig={signer_facture(self.facture.numero)}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["montant_a_payer"], 10000)
        self.assertEqual(r.data["devise"], "XOF")

    def test_recu_expose_son_lien_de_verification(self):
        transaction = self._transaction()
        with patch("apps.ligdicash.services.appeler_api", side_effect=_api_faux(CONFIRM_COMPLETED)):
            self._callback(transaction)
        recu = Receipt.objects.get(ref_transaction=transaction.transaction_id)
        r = self.api.get(f"/api/v1/finance/receipts/{recu.id}/")
        self.assertEqual(r.status_code, 200)
        lien = r.data["lien_verification"]
        self.assertIn(recu.numero, lien)
        # et la page publique de vérification répond
        from apps.ligdicash.signing import signer_recu

        r2 = self.api.get(f"/api/v1/finance/paiements/ligdicash/recu/{recu.numero}/"
                          f"?sig={signer_recu(recu.numero)}")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["facture_numero"], self.facture.numero)
