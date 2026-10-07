"""Formations HUB — webhook vitrine, facture brouillon auto, WhatsApp, reçu auto."""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.finance.models import Invoice
from apps.formations.models import Formation, InscriptionFormation, ParticipantFormation


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
