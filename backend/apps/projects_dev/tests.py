"""Tests SPEC Jira v1.4 : permissions, transitions, rapport, signature GitHub, recherche."""

import hashlib
import hmac
import json
from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bugtracker.models import BugReport
from apps.clients.models import Client
from apps.projects_dev.models import LienGit, Project, Sprint, Task


def make_user(email, role):
    return User.objects.create_user(username=email, email=email, password="pass12345", role=role)


class JiraDevTest(TestCase):
    def setUp(self):
        self.chef = make_user("chef@digicom.ml", "chef_dev")
        self.membre = make_user("membre@digicom.ml", "membre_dev")
        self.client_obj = Client.objects.create(nom_societe="Client Test")
        self.project = Project.objects.create(client=self.client_obj, titre="Site Test",
                                              type="site_web", github_repo="digicom/site-test",
                                              github_webhook_secret="secret-test-123")
        self.api = APIClient()

    def auth(self, user):
        self.api.force_authenticate(user=user)

    def test_reference_unique_et_done_at(self):
        self.auth(self.chef)
        r = self.api.post("/api/v1/tasks/", {"project": self.project.id, "titre": "Tâche ref"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        ref = r.data["reference"]
        self.assertRegex(ref, r"^TASK-\d{4}-\d{4}$")
        tid = r.data["id"]
        r = self.api.patch(f"/api/v1/tasks/{tid}/", {"statut": "done"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIsNotNone(r.data["done_at"])
        r = self.api.patch(f"/api/v1/tasks/{tid}/", {"statut": "en_cours"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["done_at"])

    def test_membre_ne_modifie_pas_estimation_403(self):
        self.auth(self.chef)
        r = self.api.post("/api/v1/tasks/", {"project": self.project.id, "titre": "Tâche prot",
                                             "estimation_points": 5, "priorite": "haute"}, format="json")
        self.assertEqual(r.status_code, 201)
        tid = r.data["id"]
        self.auth(self.membre)
        r = self.api.patch(f"/api/v1/tasks/{tid}/", {"estimation_points": 13}, format="json")
        self.assertEqual(r.status_code, 403)
        r = self.api.patch(f"/api/v1/tasks/{tid}/", {"priorite": "critique"}, format="json")
        self.assertEqual(r.status_code, 403)
        # Déplacement + temps passé autorisés.
        r = self.api.patch(f"/api/v1/tasks/{tid}/", {"statut": "en_cours", "temps_passe": 2}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_filtres_et_tri_priorite(self):
        self.auth(self.chef)
        for prio in ("basse", "critique", "normale"):
            self.api.post("/api/v1/tasks/", {"project": self.project.id, "titre": f"T {prio}",
                                              "priorite": prio}, format="json")
        r = self.api.get("/api/v1/tasks/?project=%d&priorite=critique" % self.project.id)
        self.assertEqual(r.status_code, 200)
        items = r.data["results"] if isinstance(r.data, dict) else r.data
        self.assertTrue(all(t["priorite"] == "critique" for t in items))

    def test_sprint_unique_actif_et_cloture_backlog(self):
        self.auth(self.chef)
        j = date.today()
        s1 = self.api.post("/api/v1/sprints/", {"project": self.project.id, "nom": "S1",
                                                "date_debut": str(j - timedelta(days=7)),
                                                "date_fin": str(j + timedelta(days=7))}, format="json").data
        s2 = self.api.post("/api/v1/sprints/", {"project": self.project.id, "nom": "S2",
                                                "date_debut": str(j), "date_fin": str(j + timedelta(days=7))},
                           format="json").data
        t = self.api.post("/api/v1/tasks/", {"project": self.project.id, "titre": "Sprint task",
                                              "estimation_points": 3, "sprint": s1["id"]}, format="json").data
        self.assertEqual(self.api.post(f"/api/v1/sprints/{s1['id']}/demarrer/").status_code, 200)
        # Deuxième sprint actif impossible.
        r = self.api.post(f"/api/v1/sprints/{s2['id']}/demarrer/")
        self.assertEqual(r.status_code, 400)
        # points_engages figé.
        r = self.api.get(f"/api/v1/sprints/{s1['id']}/")
        self.assertEqual(r.data["points_engages"], 3)
        # Clôture -> tâche ouverte renvoyée au backlog par défaut.
        self.assertEqual(self.api.post(f"/api/v1/sprints/{s1['id']}/terminer/", {}, format="json").status_code, 200)
        r = self.api.get(f"/api/v1/projects/{self.project.id}/backlog/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(x["id"] == t["id"] and x["sprint"] is None for x in r.data))

    def test_rapport_burndown_coherent(self):
        self.auth(self.chef)
        j = date.today()
        debut = j - timedelta(days=4)
        s = self.api.post("/api/v1/sprints/", {"project": self.project.id, "nom": "SR",
                                               "date_debut": str(debut),
                                               "date_fin": str(j + timedelta(days=5))}, format="json").data
        t1 = self.api.post("/api/v1/tasks/", {"project": self.project.id, "titre": "R1",
                                               "estimation_points": 5, "sprint": s["id"]}, format="json").data
        self.api.post("/api/v1/tasks/", {"project": self.project.id, "titre": "R2",
                                          "estimation_points": 3, "sprint": s["id"]}, format="json")
        self.api.post(f"/api/v1/sprints/{s['id']}/demarrer/")
        self.api.patch(f"/api/v1/tasks/{t1['id']}/", {"statut": "done"}, format="json")
        r = self.api.get(f"/api/v1/sprints/{s['id']}/rapport/")
        self.assertEqual(r.status_code, 200)
        serie = r.data["serie"]
        self.assertTrue(len(serie) >= 1)
        # Dernière valeur réelle = 8 - 5 = 3 (t1 terminée).
        self.assertEqual(serie[-1]["restant_reel"], 3)
        self.assertEqual(r.data["totaux"]["points_engages"], 8)

    def test_github_push_cree_lien_et_403_signature(self):
        tache = Task.objects.create(project=self.project, titre="Login mobile",
                                    estimation_points=2)
        payload = {"ref": "refs/heads/feature/%s-login" % tache.reference.lower(),
                   "repository": {"full_name": "digicom/site-test"},
                   "commits": [{"id": "abc123", "message": "fix: login mobile %s" % tache.reference,
                                "url": "https://github.com/x/y/commit/abc123",
                                "author": {"username": "dev1"}}]}
        corps = json.dumps(payload).encode()
        # Mauvaise signature -> 403, rien enregistré.
        r = self.client.post(f"/api/v1/github/webhook/{self.project.id}/", data=corps,
                             content_type="application/json",
                             HTTP_X_HUB_SIGNATURE_256="sha256=bad",
                             HTTP_X_GITHUB_DELIVERY="deliv-1", HTTP_X_GITHUB_EVENT="push")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(LienGit.objects.count(), 0)
        # Bonne signature -> lien commit visible.
        sig = "sha256=" + hmac.new(b"secret-test-123", corps, hashlib.sha256).hexdigest()
        r = self.client.post(f"/api/v1/github/webhook/{self.project.id}/", data=corps,
                             content_type="application/json",
                             HTTP_X_HUB_SIGNATURE_256=sig,
                             HTTP_X_GITHUB_DELIVERY="deliv-1", HTTP_X_GITHUB_EVENT="push")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(LienGit.objects.filter(task=tache, type="commit",
                                               identifiant_externe="abc123").exists())
        # Rejeu même livraison -> 200 sans doublon.
        r = self.client.post(f"/api/v1/github/webhook/{self.project.id}/", data=corps,
                             content_type="application/json",
                             HTTP_X_HUB_SIGNATURE_256=sig,
                             HTTP_X_GITHUB_DELIVERY="deliv-1", HTTP_X_GITHUB_EVENT="push")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(LienGit.objects.filter(task=tache, type="commit").count(), 1)

    def test_github_pr_fusionnee_passe_review_si_option(self):
        self.project.github_auto_statut = True
        self.project.save(update_fields=["github_auto_statut"])
        tache = Task.objects.create(project=self.project, titre="PR auto", statut="en_cours")
        payload = {"action": "closed",
                   "repository": {"full_name": "digicom/site-test"},
                   "pull_request": {"number": 7, "title": "Feat %s" % tache.reference,
                                    "body": "", "html_url": "https://github.com/x/y/pull/7",
                                    "merged": True, "user": {"login": "dev1"},
                                    "head": {"ref": "feat-x"}}}
        corps = json.dumps(payload).encode()
        sig = "sha256=" + hmac.new(b"secret-test-123", corps, hashlib.sha256).hexdigest()
        r = self.client.post(f"/api/v1/github/webhook/{self.project.id}/", data=corps,
                             content_type="application/json",
                             HTTP_X_HUB_SIGNATURE_256=sig,
                             HTTP_X_GITHUB_DELIVERY="deliv-pr-1", HTTP_X_GITHUB_EVENT="pull_request")
        self.assertEqual(r.status_code, 200)
        tache.refresh_from_db()
        self.assertEqual(tache.statut, "review")

    def test_recherche_projets_navigation_et_client(self):
        self.auth(self.membre)
        r = self.api.get("/api/v1/search/?q=projets")
        self.assertEqual(r.status_code, 200)
        nav = next((g for g in r.data["groupes"] if g["type"] == "navigation"), None)
        self.assertIsNotNone(nav)
        self.assertTrue(any(x["url"] == "/projets" for x in nav["resultats"]))
        # Nom du client -> projet trouvé.
        r = self.api.get("/api/v1/search/?q=Client%20Test")
        types = [g["type"] for g in r.data["groupes"]]
        self.assertIn("projet", types)

    def test_recherche_navigation_filtree_par_role(self):
        self.auth(self.membre)
        r = self.api.get("/api/v1/search/?q=facture")
        self.assertEqual(r.status_code, 200)
        nav = next((g for g in r.data["groupes"] if g["type"] == "navigation"), None)
        urls = [x["url"] for x in (nav["resultats"] if nav else [])]
        self.assertNotIn("/factures", urls)

    def test_recherche_membre_dev_sans_facture(self):
        self.auth(self.membre)
        tache = Task.objects.create(project=self.project, titre="Recherche xyz")
        r = self.api.get("/api/v1/search/?q=%s" % tache.reference)
        self.assertEqual(r.status_code, 200)
        types = [g["type"] for g in r.data["groupes"]]
        self.assertIn("tache", types)
        self.assertNotIn("facture", types)
        r = self.api.get("/api/v1/search/?q=a")
        self.assertEqual(r.status_code, 400)

    def test_secret_jamais_expose(self):
        self.auth(self.chef)
        r = self.api.get(f"/api/v1/projects/{self.project.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("github_webhook_secret", r.data)
        r = self.api.post(f"/api/v1/projects/{self.project.id}/github/regenerer-secret/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("secret", r.data)
