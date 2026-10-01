"""Tests décharges — upload multipart, compression serveur, référence, garde suppression."""

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.test import TestCase

from apps.accounts.models import User
from apps.secretariat_tickets.models import Decharge


def image_test(l=2500, h=1800):
    from PIL import Image

    img = Image.new("RGB", (l, h), (30, 90, 160))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return SimpleUploadedFile("scan.png", buf.getvalue(), content_type="image/png")


class DechargesTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="adm", email="adm@digicom.ml", password="x", role="admin")
        self.membre = User.objects.create_user(
            username="m", email="m@digicom.ml", password="x", role="membre_com")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_creation_compresse_et_reference(self):
        r = self.client.post("/api/v1/secretariat/decharges/", {
            "provenance": "Orange Mali", "objet": "Remise espèces",
            "montant": "50000", "image": image_test(),
        }, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["reference"].startswith("DCH-"))
        d = Decharge.objects.get(id=r.data["id"])
        self.assertTrue(d.image.name.endswith(".jpg"))
        self.assertGreater(d.poids_ko, 0)
        # Recompression évitée à la re-sauvegarde sans changement d'image
        nom = d.image.name
        d.commentaire = "vu"
        d.save()
        self.assertEqual(Decharge.objects.get(id=d.id).image.name, nom)

    def test_grande_photo_reduite(self):
        from PIL import Image

        d = Decharge(provenance="X", objet="Y",
                     image=image_test(4000, 3000))
        d.save()
        img = Image.open(d.image.path)
        self.assertLessEqual(max(img.size), 1600)

    def test_suppression_reservee_admin(self):
        d = Decharge.objects.create(
            provenance="X", objet="Y", image=image_test(100, 100))
        self.client.force_authenticate(self.membre)
        self.assertEqual(
            self.client.delete(f"/api/v1/secretariat/decharges/{d.id}/").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.delete(f"/api/v1/secretariat/decharges/{d.id}/").status_code, 204)
