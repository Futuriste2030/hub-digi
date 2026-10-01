// fournisseurs — FAIT (30/09/2026)
// Module Achats miroir Clients, périmètre Finance.
// Backend apps/fournisseurs : Fournisseur, FactureFournisseur (+lignes), PaiementFournisseur,
//   BonCommande (+lignes, BDC-SLUG-JJ-MM-AAAA-ID), BonLivraison (+lignes, BDL-SLUG-JJ-MM-AAAA-ID).
//   Cycle : commande (brouillon→validée→envoyée) → livraison (valide, impute quantités,
//   partiellement_livrée/livrée) → convertir (→ facture ACHAT) → payer (→ payée/partielle).
//   Endpoints : /fournisseurs/, /:id/overview/, /fournisseurs-factures/ (valider/payer/pdf),
//   /fournisseurs-paiements/ (pdf reçu), /fournisseurs-commandes/ (valider/envoyer/convertir/pdf),
//   /fournisseurs-livraisons/ (valider/pdf). Suppression chef_finance/super_admin, bloquée si liens.
//   Références serveur : references.generer_reference + CompteurReference (préfixe+année, atomique) :
//   BDC/BDL/ACHAT/RECU-F-SLUG-AAAA-NNNN (migration 0003, backfill reçus existants).
// Frontend : /finance/fournisseurs + /finance/fournisseurs/:id (onglets Commandes / Livraisons /
//   Factures & Reçus, conversion en 1 clic, téléchargement PDF), lien sidebar Finance, guard ROLES_FINANCE.
// SPEC §5.7 étendu — voir SPECIFICATIONS.md MAJ 30/09/2026.
