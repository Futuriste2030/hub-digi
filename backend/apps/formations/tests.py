"""Formations HUB — webhook vitrine, facture brouillon auto, WhatsApp, reçu auto."""

import zipfile
from datetime import date
from io import BytesIO

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.finance.models import Invoice
from apps.formations.liens import lien_verification_attestation
from apps.formations.models import (AttestationFormation, Formation, InscriptionFormation,
                                    ParticipantFormation)
from apps.formations.signing import signer_attestation


TOKEN = "token-test-32-caracteres-minimum-hub"


def _payload(**kwargs):
    base = {
        "formation_reference": "django-web",
        "formation_titre": "Django Web",
        "formation_prix": 50000,
        "nom": "Awa Traoré",
        "email": "awa@mail.ml",
        "telephone": "+22370000000",
        "message": "Motivée",
        "reference_site": "FMT-2026-X",
    }
    base.update(kwargs)
    return base


@override_settings(CAREER_WEBHOOK_TOKEN=TOKEN)
class WebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_sans_token_403(self):
        r = self.client.post("/api/v1/formations/inscriptions/", _payload())
        self.assertEqual(r.status_code, 403)

    def test_payload_invalide_400(self):
        r = self.client.post("/api/v1/formations/inscriptions/", _payload(email="pas-un-mail"),
                             HTTP_X_HUB_TOKEN=TOKEN)
        self.assertEqual(r.status_code, 400)

    def test_creation_201_facture_brouillon(self):
        r = self.client.post("/api/v1/formations/inscriptions/", _payload(),
                             HTTP_X_HUB_TOKEN=TOKEN)
        self.assertEqual(r.status_code, 201)
        insc = InscriptionFormation.objects.get()
        self.assertTrue(insc.reference.startswith("INS-"))
        # Pas de Client créé : participant propre à l'app formations.
        self.assertEqual(ParticipantFormation.objects.count(), 1)
        facture = Invoice.objects.get()
        self.assertIsNone(facture.client)
        self.assertEqual(facture.inscription, insc)
        self.assertEqual(facture.statut, Invoice.STATUT_BROUILLON)
        self.assertEqual(float(facture.total), 50000)
        self.assertIn("FACTURE", facture.numero)
        self.assertEqual(r.data["facture_numero"], facture.numero)

    def test_doublon_email_formation_200(self):
        url = "/api/v1/formations/inscriptions/"
        self.client.post(url, _payload(), HTTP_X_HUB_TOKEN=TOKEN)
        r = self.client.post(url, _payload(), HTTP_X_HUB_TOKEN=TOKEN)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get("doublon"))
        self.assertEqual(InscriptionFormation.objects.count(), 1)
        self.assertEqual(Invoice.objects.count(), 1)


class FactureFormationTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="fin@digicom.ml", email="fin@digicom.ml",
                                              password="x", role="chef_finance")
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)
        formation = Formation.objects.create(slug="django-web", titre="Django Web", prix=50000)
        participant = ParticipantFormation.objects.create(full_name="Awa Traoré",
                                                          email="awa@mail.ml",
                                                          phone="+22370000000")
        self.inscription = InscriptionFormation.objects.create(formation=formation,
                                                               participant=participant)
        from apps.finance.models import InvoiceLigne

        self.facture = Invoice.objects.create(client=None, inscription=self.inscription,
                                              statut=Invoice.STATUT_BROUILLON)
        InvoiceLigne.objects.create(invoice=self.facture, description="Formation : Django Web",
                                    quantite=1, montant=50000)

    def test_whatsapp_passe_envoyee(self):
        r = self.client.post(f"/api/v1/finance/invoices/{self.facture.id}/whatsapp/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["telephone"], "22370000000")
        self.assertIn("FACTURE", r.data["message"])
        self.assertIn("Awa", r.data["message"])
        self.facture.refresh_from_db()
        self.assertEqual(self.facture.statut, Invoice.STATUT_ENVOYEE)
        self.assertIsNotNone(self.facture.envoyee_le)

    def test_whatsapp_refuse_facture_classique(self):
        from apps.clients.models import Client

        cli = Client.objects.create(nom_societe="Orange Mali", email="o@o.ml")
        f = Invoice.objects.create(client=cli, statut=Invoice.STATUT_BROUILLON)
        r = self.client.post(f"/api/v1/finance/invoices/{f.id}/whatsapp/")
        self.assertEqual(r.status_code, 400)

    def test_paiement_recu_auto_et_statut(self):
        r = self.client.post(f"/api/v1/finance/invoices/{self.facture.id}/payer/",
                             {"montant": 50000, "moyen": "mobile_money",
                              "ref_transaction": "TX-1"})
        self.assertEqual(r.status_code, 201)
        self.assertIn("RECU", r.data["numero"])
        self.facture.refresh_from_db()
        self.assertEqual(self.facture.statut, Invoice.STATUT_PAYEE)
        self.assertEqual(float(self.facture.solde), 0)

    def test_pdf_facture_participant(self):
        r = self.client.get(f"/api/v1/finance/invoices/{self.facture.id}/pdf/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("pdf", r["Content-Type"])

    def test_stats(self):
        r = self.client.get("/api/v1/formations/inscriptions/stats/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["total_facture"], 50000)
        self.assertEqual(r.data["reste"], 50000)

    def test_suppression_bloquee_si_payee(self):
        self.client.post(f"/api/v1/finance/invoices/{self.facture.id}/payer/",
                         {"montant": 50000, "moyen": "especes"})
        r = self.client.delete(f"/api/v1/formations/inscriptions/{self.inscription.id}/")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(InscriptionFormation.objects.filter(id=self.inscription.id).exists())

    def test_suppression_non_payee_supprime_facture(self):
        r = self.client.delete(f"/api/v1/formations/inscriptions/{self.inscription.id}/")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Invoice.objects.filter(id=self.facture.id).exists())

    def test_suppression_reservee_chef(self):
        membre = User.objects.create_user(username="m", email="m@digicom.ml", password="x",
                                          role="membre_finance")
        self.client.force_authenticate(user=membre)
        r = self.client.delete(f"/api/v1/formations/inscriptions/{self.inscription.id}/")
        self.assertEqual(r.status_code, 403)


@override_settings(CAREER_WEBHOOK_TOKEN=TOKEN)
class PayWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        formation = Formation.objects.create(slug="django-web", titre="Django Web", prix=50000)
        participant = ParticipantFormation.objects.create(full_name="Awa Traoré",
                                                          email="awa@mail.ml",
                                                          phone="+22370000000")
        inscription = InscriptionFormation.objects.create(formation=formation,
                                                          participant=participant)
        from apps.finance.models import InvoiceLigne

        self.facture = Invoice.objects.create(client=None, inscription=inscription,
                                              statut=Invoice.STATUT_BROUILLON)
        InvoiceLigne.objects.create(invoice=self.facture, description="Formation : Django Web",
                                    quantite=1, montant=50000)
        self.url = "/api/v1/finance/paiements/webhook/"
        self.payload = {"facture_numero": self.facture.numero, "montant": 50000,
                        "ref_transaction": "PAY-1", "moyen": "mobile_money"}

    def test_sans_token_403(self):
        r = self.client.post(self.url, self.payload)
        self.assertEqual(r.status_code, 403)

    def test_confirmation_201_recu_auto(self):
        r = self.client.post(self.url, self.payload, HTTP_X_HUB_TOKEN=TOKEN)
        self.assertEqual(r.status_code, 201)
        self.assertIn("RECU", r.data["numero"])
        self.assertEqual(r.data["statut_facture"], Invoice.STATUT_PAYEE)
        self.facture.refresh_from_db()
        self.assertEqual(float(self.facture.solde), 0)

    def test_idempotent_meme_ref(self):
        self.client.post(self.url, self.payload, HTTP_X_HUB_TOKEN=TOKEN)
        r = self.client.post(self.url, self.payload, HTTP_X_HUB_TOKEN=TOKEN)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get("doublon"))
        from apps.finance.models import Receipt

        self.assertEqual(Receipt.objects.filter(ref_transaction="PAY-1").count(), 1)

    def test_facture_inconnue_404(self):
        r = self.client.post(self.url, {**self.payload, "facture_numero": "FACTURE-X"},
                             HTTP_X_HUB_TOKEN=TOKEN)
        self.assertEqual(r.status_code, 404)


class AttestationTests(TestCase):
    """Attestations de formation — génération, PDF, lien public signé."""

    def setUp(self):
        self.api = APIClient()
        self.formation = Formation.objects.create(
            slug="django-web", titre="Django Web", prix=50000, duree="40 heures",
            date_debut=date(2026, 6, 1), date_fin=date(2026, 6, 5), lieu="Bamako")
        self.admin = User.objects.create_user(
            username="admin", email="admin@exemple.com", password="x", role="super_admin")
        self.api.force_authenticate(self.admin)
        self.participant = ParticipantFormation.objects.create(
            full_name="Awa Traoré", email="awa@mail.ml", phone="+22370000000")
        self.inscription = InscriptionFormation.objects.create(
            formation=self.formation, participant=self.participant,
            statut=InscriptionFormation.STATUT_TERMINEE)

    # --- Génération ---------------------------------------------------

    def test_generation_cree_un_numero_unique(self):
        r = self.api.post(f"/api/v1/formations/inscriptions/{self.inscription.id}/attestation/", {})
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["creee"])
        self.assertTrue(r.data["numero"].startswith("ATT-"))
        self.assertEqual(AttestationFormation.objects.count(), 1)

    def test_generation_est_idempotente(self):
        url = f"/api/v1/formations/inscriptions/{self.inscription.id}/attestation/"
        r1 = self.api.post(url, {})
        r2 = self.api.post(url, {})
        self.assertEqual(r2.status_code, 200)
        self.assertFalse(r2.data["creee"])
        self.assertEqual(r1.data["numero"], r2.data["numero"])
        self.assertEqual(AttestationFormation.objects.count(), 1)

    def test_inscription_non_eligible_refusee(self):
        self.inscription.statut = InscriptionFormation.STATUT_RECUE
        self.inscription.save()
        r = self.api.post(f"/api/v1/formations/inscriptions/{self.inscription.id}/attestation/", {})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(AttestationFormation.objects.count(), 0)

    def test_client_ne_peut_pas_delivrer(self):
        client = User.objects.create_user(
            username="cli", email="cli@exemple.com", password="x", role="client")
        api = APIClient()
        api.force_authenticate(client)
        r = api.post(f"/api/v1/formations/inscriptions/{self.inscription.id}/attestation/", {})
        self.assertEqual(r.status_code, 403)

    # --- Génération par formation --------------------------------------

    def test_bulk_ignore_les_non_eligibles(self):
        autre = ParticipantFormation.objects.create(full_name="Bakary T", email="bak@ml")
        InscriptionFormation.objects.create(
            formation=self.formation, participant=autre, statut=InscriptionFormation.STATUT_RECUE)
        r = self.api.post(f"/api/v1/formations/catalogue/{self.formation.id}/attestations/", {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["creees_nombre"], 1)
        self.assertEqual(r.data["ignorees_nombre"], 1)
        self.assertIn("statut", r.data["ignorees"][0]["motif"])

    def test_bulk_ne_duplique_pas(self):
        url = f"/api/v1/formations/catalogue/{self.formation.id}/attestations/"
        self.api.post(url, {})
        r = self.api.post(url, {})
        self.assertEqual(r.data["creees_nombre"], 0)
        self.assertEqual(r.data["existantes_nombre"], 1)

    # --- PDF et ZIP ---------------------------------------------------

    def test_pdf_genere(self):
        att = AttestationFormation.objects.create(inscription=self.inscription)
        r = self.api.get(f"/api/v1/formations/attestations/{att.id}/pdf/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("pdf", r["Content-Type"])
        self.assertGreater(len(b"".join(r.streaming_content)), 1000)

    def test_zip_des_attestations(self):
        AttestationFormation.objects.create(inscription=self.inscription)
        r = self.api.get(f"/api/v1/formations/catalogue/{self.formation.id}/attestations/zip/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("zip", r["Content-Type"])
        contenu = b"".join(r.streaming_content)
        with zipfile.ZipFile(BytesIO(contenu)) as archive:
            self.assertEqual(len(archive.namelist()), 1)
            self.assertTrue(archive.namelist()[0].endswith(".pdf"))

    # --- Vérification publique -----------------------------------------

    def test_verification_publique_avec_bonne_signature(self):
        att = AttestationFormation.objects.create(inscription=self.inscription)
        sig = signer_attestation(att.numero)
        r = self.api.get(f"/api/v1/formations/verification/{att.numero}/?sig={sig}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["participant"], "Awa Traoré")
        self.assertEqual(r.data["formation"], "Django Web")
        self.assertEqual(r.data["numero"], att.numero)

    def test_verification_publique_signature_invalide_403(self):
        att = AttestationFormation.objects.create(inscription=self.inscription)
        r = self.api.get(f"/api/v1/formations/verification/{att.numero}/?sig=bidon")
        self.assertEqual(r.status_code, 403)

    def test_signature_facture_ne_sert_pas_pour_attestation(self):
        """Isolation des contextes : une signature de reçu ne vérifie pas une attestation."""
        from apps.ligdicash.signing import signer_recu

        att = AttestationFormation.objects.create(inscription=self.inscription)
        r = self.api.get(f"/api/v1/formations/verification/{att.numero}/?sig={signer_recu(att.numero)}")
        self.assertEqual(r.status_code, 403)

    def test_lien_public_unique_et_stable(self):
        att = AttestationFormation.objects.create(inscription=self.inscription)
        lien1 = lien_verification_attestation(att.numero)
        lien2 = lien_verification_attestation(att.numero)
        self.assertEqual(lien1, lien2)  # stable (figable dans un QR imprimé)
        self.assertIn(att.numero, lien1)
        self.assertIn("sig=", lien1)
