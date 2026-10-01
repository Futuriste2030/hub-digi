"""Tests bugtracker — report public + notifs Chef Dév/Super Admin (+ mail si critique)."""

from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bugtracker.models import BugReport, ProjectTrackerKey
from apps.clients.models import Client
from apps.core.models import Notification
from apps.projects_dev.models import Project


class ReportNotifTests(TestCase):
    def setUp(self):
        self.chef = User.objects.create_user(
            username="chef", email="chef@digicom.ml", password="x", role="chef_dev")
        self.sa = User.objects.create_user(
            username="sa", email="sa@digicom.ml", password="x", role="super_admin")
        self.adm = User.objects.create_user(
            username="adm", email="adm@digicom.ml", password="x", role="admin")
        client = Client.objects.create(nom_societe="Test")
        project = Project.objects.create(client=client, titre="Site", type="site_web")
        self.key = ProjectTrackerKey.objects.create(project=project)
        self.client = APIClient()  # endpoint public, sans auth

    def test_report_notifie_chef_et_super_admin(self):
        r = self.client.post("/api/v1/bugs/report/", {
            "key": self.key.public_key, "message": "TypeError",
            "url": "https://client.ml/", "meta": {},
        }, format="json")
        self.assertEqual(r.status_code, 201)
        bug = BugReport.objects.get(numero=r.data["numero"])
        notifies = set(Notification.objects.filter(titre__contains=bug.numero)
                       .values_list("destinataire__role", flat=True))
        self.assertEqual(notifies, {"chef_dev", "super_admin"})
        self.assertEqual(len(mail.outbox), 0)  # pas critique => pas de mail

    def test_critique_notifie_admin_et_mail(self):
        r = self.client.post("/api/v1/bugs/report/", {
            "key": self.key.public_key, "message": "Crash total", "gravite": "critique",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        bug = BugReport.objects.get(numero=r.data["numero"])
        self.assertEqual(bug.gravite, "critique")
        notifies = set(Notification.objects.filter(titre__contains=bug.numero)
                       .values_list("destinataire__role", flat=True))
        self.assertEqual(notifies, {"chef_dev", "super_admin", "admin"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(bug.numero, mail.outbox[0].subject)

    def test_gravite_invalide_repliee(self):
        r = self.client.post("/api/v1/bugs/report/", {
            "key": self.key.public_key, "message": "X", "gravite": "nimporte",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(BugReport.objects.get(numero=r.data["numero"]).gravite, "moyenne")
