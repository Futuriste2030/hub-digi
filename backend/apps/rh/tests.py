"""Recrutement — circuit statuer/ : transitions contrôlées + mail candidat systématique."""

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.mailing.models import SentMail
from apps.rh.models import Candidature


def make_candidature(statut="recue"):
    return Candidature.objects.create(
        offre_reference="dev-backend-django", offre_titre="Dev Backend Django",
        nom="Awa Traoré", email="awa@mail.ml", telephone="+22370000000",
        source="site", statut=statut,
    )


def make_user(role):
    return User.objects.create_user(username=f"{role}@x.ml", email=f"{role}@x.ml",
                                    password="x", role=role)


class StatuerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=make_user("chef_rh"))

    def test_recue_vers_entretien_avec_mail(self):
        cand = make_candidature()
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "entretien", "message": "Le 12/10 à 10h."})
        self.assertEqual(r.status_code, 200)
        cand.refresh_from_db()
        self.assertEqual(cand.statut, "entretien")
        mail = SentMail.objects.filter(to="awa@mail.ml").latest("cree_le")
        self.assertIn("Entretien", mail.subject)

    def test_entretien_vers_retenue_avec_mail(self):
        cand = make_candidature(statut="entretien")
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "retenue", "message": "Démarrage le 01/11."})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Candidature.objects.get(id=cand.id).statut, "retenue")
        mail = SentMail.objects.filter(to="awa@mail.ml").latest("cree_le")
        self.assertIn("retenue", mail.subject.lower())

    def test_rejet_exige_motif_et_notifie(self):
        cand = make_candidature(statut="entretien")
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "rejetee"})
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "rejetee", "message": "Profil non correspondant."})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Candidature.objects.get(id=cand.id).statut, "rejetee")
        mail = SentMail.objects.filter(to="awa@mail.ml").latest("cree_le")
        self.assertIn("Suite de votre candidature", mail.subject)

    def test_transition_impossible_400(self):
        cand = make_candidature()  # recue -> retenue direct interdite
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "retenue"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Candidature.objects.get(id=cand.id).statut, "recue")

    def test_retenue_finale(self):
        cand = make_candidature(statut="retenue")
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "rejetee", "message": "Trop tard."})
        self.assertEqual(r.status_code, 400)

    def test_role_membre_refuse(self):
        self.client.force_authenticate(user=make_user("membre_rh"))
        cand = make_candidature()
        r = self.client.post(f"/api/v1/rh/recruitments/{cand.id}/statuer/",
                             {"decision": "entretien"})
        self.assertEqual(r.status_code, 403)

    def test_patch_brut_ne_change_plus_le_statut(self):
        cand = make_candidature()
        r = self.client.patch(f"/api/v1/rh/recruitments/{cand.id}/",
                              {"statut": "retenue"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Candidature.objects.get(id=cand.id).statut, "recue")
