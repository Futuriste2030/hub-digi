"""Tests mailing — filtrage par user (super_admin = tout) + copie CC réelle."""

from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.departments.models import Department
from apps.mailing.models import EmailIdentity, SentMail


def make_user(email, role, dept=None):
    return User.objects.create_user(username=email, email=email, password="x", role=role,
                                    department=dept)


class MailScopeCcTests(TestCase):
    def setUp(self):
        self.com = Department.objects.create(nom="Communication", slug="communication")
        self.dev = Department.objects.create(nom="Développement", slug="developpement")
        EmailIdentity.objects.create(department=self.com, from_address="com@digicom.ml")
        EmailIdentity.objects.create(department=self.dev, from_address="dev@digicom.ml")
        self.alice = make_user("alice@digicom.ml", "membre_com", self.com)
        self.bob = make_user("bob@digicom.ml", "membre_dev", self.dev)
        self.sa = make_user("sa@digicom.ml", "super_admin")
        self.api = APIClient()

    def envoyer(self, user, payload=None):
        self.api.force_authenticate(user=user)
        base = {"to": "client@mail.ml", "subject": "Bonjour", "body_html": "<p>Contenu du message ici</p>"}
        base.update(payload or {})
        return self.api.post("/api/v1/mailing/send/", base, format="json")

    def test_auteur_enregistre_et_cc_envoyee(self):
        r = self.envoyer(self.alice, {"cc": ["copie@digicom.ml", "COPiE@digicom.ml", "client@mail.ml"]})
        self.assertEqual(r.status_code, 201, r.content)
        obj = SentMail.objects.get(id=r.data["id"])
        self.assertEqual(obj.auteur, self.alice)
        # Doublons insensibles à la casse fusionnés, destinataire exclu de la copie.
        self.assertEqual(obj.liste_cc, ["copie@digicom.ml"])
        envoye = mail.outbox[-1]
        self.assertEqual(envoye.cc, ["copie@digicom.ml"])
        self.assertIn("client@mail.ml", envoye.to)

    def test_cc_invalide_rejetee_400(self):
        r = self.envoyer(self.alice, {"cc": ["pas-un-mail"]})
        self.assertEqual(r.status_code, 400)

    def test_chacun_ne_voit_que_ses_envois(self):
        self.envoyer(self.alice)
        self.api.force_authenticate(user=self.bob)
        r = self.api.get("/api/v1/mailing/sent/")
        self.assertEqual(r.status_code, 200)
        items = r.data["results"] if isinstance(r.data, dict) else r.data
        self.assertEqual(items, [])
        # Super Admin voit tout, avec l'auteur affiché.
        self.api.force_authenticate(user=self.sa)
        r = self.api.get("/api/v1/mailing/sent/")
        items = r.data["results"] if isinstance(r.data, dict) else r.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["auteur"], self.alice.id)
        self.assertEqual(items[0]["auteur_email"], "alice@digicom.ml")
