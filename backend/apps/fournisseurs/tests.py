"""Tests fournisseurs — CRUD + cycle commande→livraison→facture→paiement + PDF."""

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.fournisseurs.models import FactureFournisseur, Fournisseur


class FournisseursTests(TestCase):
    def setUp(self):
        self.chef = User.objects.create_user(username="chef", email="chef@digicom.ml", password="x", role="chef_finance")
        self.membre = User.objects.create_user(username="m", email="m@digicom.ml", password="x", role="membre_finance")
        self.client = APIClient()
        self.client.force_authenticate(self.chef)

    def test_crud_et_paiement(self):
        r = self.client.post("/api/v1/fournisseurs/", {"nom_societe": "Imprim Sud", "categorie": "Imprimerie"})
        self.assertEqual(r.status_code, 201)
        fid = r.data["id"]
        r = self.client.post("/api/v1/fournisseurs-factures/", {
            "fournisseur": fid, "objet": "Flyers",
            "lignes": [{"description": "Flyers A5", "quantite": 2, "montant": 50000}],
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["numero"][:6], "ACHAT-")
        facture_id = r.data["id"]
        r = self.client.post(f"/api/v1/fournisseurs-factures/{facture_id}/payer/",
                             {"montant": 40000, "moyen": "virement"}, format="json")
        self.assertEqual(r.status_code, 201)
        facture = FactureFournisseur.objects.prefetch_related("lignes", "paiements").get(id=facture_id)
        self.assertEqual(facture.statut, FactureFournisseur.STATUT_PARTIELLE)
        # Suppression fournisseur lié -> 400
        r = self.client.delete(f"/api/v1/fournisseurs/{fid}/")
        self.assertEqual(r.status_code, 400)
        # Membre ne peut pas supprimer -> 403
        self.client.force_authenticate(self.membre)
        r = self.client.delete(f"/api/v1/fournisseurs-factures/{facture_id}/")
        self.assertEqual(r.status_code, 403)

    def test_overview(self):
        f = Fournisseur.objects.create(nom_societe="Host ML")
        r = self.client.get(f"/api/v1/fournisseurs/{f.id}/overview/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("solde_du", r.data)
        self.assertIn("commandes", r.data)
        self.assertIn("livraisons", r.data)

    def test_references_sequentielles(self):
        import re

        from apps.fournisseurs.references import generer_reference
        annee = __import__("django.utils.timezone", fromlist=["localdate"]).localdate().year
        r1 = generer_reference("BDC", "Imprim Sud")
        r2 = generer_reference("BDC", "Imprim Sud")
        self.assertTrue(re.fullmatch(rf"BDC-IMPRIM-SUD-{annee}-\d{{4}}", r1))
        n1, n2 = int(r1.rsplit("-", 1)[1]), int(r2.rsplit("-", 1)[1])
        self.assertEqual(n2, n1 + 1)  # séquentiel, sans trou ni doublon
        # Compteur indépendant par préfixe
        rbdl = generer_reference("BDL", "Imprim Sud")
        self.assertTrue(rbdl.startswith("BDL-IMPRIM-SUD-"))

    def test_cycle_commande_livraison_facture_pdf(self):
        f = Fournisseur.objects.create(nom_societe="Papeterie Nord")
        # 1. Bon de commande avec lignes
        r = self.client.post("/api/v1/fournisseurs-commandes/", {
            "fournisseur": f.id, "objet": "Ramettes A4",
            "lignes": [
                {"description": "Ramette A4 80g", "quantite": 10, "montant": 3500},
                {"description": "Cartouche", "quantite": 2, "montant": 15000},
            ],
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["numero"].startswith("BDC-"))
        bc_id = r.data["id"]
        lc_id = None
        # 2. Convertir avant livraison -> 400
        r = self.client.post(f"/api/v1/fournisseurs-commandes/{bc_id}/convertir/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        # 3. Valider + envoyer
        self.assertEqual(self.client.post(
            f"/api/v1/fournisseurs-commandes/{bc_id}/valider/", {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(
            f"/api/v1/fournisseurs-commandes/{bc_id}/envoyer/", {}, format="json").status_code, 200)
        # 4. Bon de livraison partiel (5/10 ramettes)
        from apps.fournisseurs.models import BonCommande
        lc_id = BonCommande.objects.get(id=bc_id).lignes.first().id
        r = self.client.post("/api/v1/fournisseurs-livraisons/", {
            "fournisseur": f.id, "commande": bc_id,
            "lignes": [{"description": "Ramette A4 80g", "quantite": 5,
                        "montant": 3500, "ligne_commande": lc_id}],
        }, format="json")
        self.assertEqual(r.status_code, 201)
        bl_id = r.data["id"]
        r = self.client.post(f"/api/v1/fournisseurs-livraisons/{bl_id}/valider/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(BonCommande.objects.get(id=bc_id).statut, "partiellement_livree")
        # 5. Convertir en facture
        r = self.client.post(f"/api/v1/fournisseurs-commandes/{bc_id}/convertir/", {}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["numero"].startswith("ACHAT-"))
        facture_id = r.data["id"]
        # 6. PDF : commande, livraison, facture
        for url in (f"/api/v1/fournisseurs-commandes/{bc_id}/pdf/",
                    f"/api/v1/fournisseurs-livraisons/{bl_id}/pdf/",
                    f"/api/v1/fournisseurs-factures/{facture_id}/pdf/"):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 200)
            self.assertIn("application/pdf", r["Content-Type"])
        # 7. Payer + reçu PDF (référence RECU-F-...)
        r = self.client.post(f"/api/v1/fournisseurs-factures/{facture_id}/payer/",
                             {"montant": 10000, "moyen": "virement"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["numero"].startswith("RECU-F-"))
        r = self.client.get(f"/api/v1/fournisseurs-paiements/{r.data['id']}/pdf/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("application/pdf", r["Content-Type"])
