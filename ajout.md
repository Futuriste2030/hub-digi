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

// ligdicash — FAIT (19/10/2026)
// Paiement en ligne branché sur LigdiCash (payin avec redirection). Remplace
// l'ancienne hypothèse « site externe pay.digicom.ml » : le client paie
// désormais depuis l'espace client ou depuis le lien unique de sa facture.
// Backend apps/ligdicash : PayinTransaction (transaction_id maison PAI-AAAAMMJJ-XXXXXX,
//   montant figé, statut pending/completed/notcompleted, token de CRÉATION, pay_url,
//   opérateur, request_id, réponse brute). Client HTTP stdlib (urllib) : pas de dépendance ajoutée.
//   Endpoints : POST /finance/paiements/ligdicash/initier/ (authentifié), POST .../initier-lien/
//   (public, lien signé), GET .../facture/<numero>/ (public, signé), GET .../recu/<numero>/
//   (public, signé), GET .../retour/<txn>/ (public, signé), GET .../<txn>/statut/ (authentifié),
//   POST .../callback/ (public, callback LigdiCash).
//   Règles : `customer` toujours vide (sinon LigdiCash masque les opérateurs) ; `otp` vide ;
//   transaction_id injecté dans custom_data (le token API n'est pas stable entre création et callback) ;
//   callback RE-VÉRIFIÉ via /confirm avec le token de création (le payload n'est jamais cru) ;
//   déduplication du double POST LigdiCash (statut en base) ; montant encaissé comparé au montant figé
//   (écart => rien n'est encaissé, anomalie tracée) ; reçu auto + mail recu_disponible.
//   Liens uniques signés (HMAC sur SECRET_KEY) : /paiement/facture/<numero> (lien de PAIEMENT, figé
//   dans le QR de la facture PDF + mail facture_disponible/relance + WhatsApp + bouton « copier »)
//   et /paiement/recu/<numero> (lien de VÉRIFICATION, figé dans le QR du reçu PDF et du reçu imprimable).
//   Le lien est stable dans le temps ; le montant, lui, est TOUJOURS recalculé par le serveur.
//   Interrupteurs : PAYMENT_ENABLED (master) + LIGDICASH_ENABLED (fournisseur) + clés LIGDICASH_*.
//   Commande de test réel : python manage.py ligdicash_test (facture 100 XOF, jamais payée).
// Frontend : pages publiques /paiement/facture/:numero, /paiement/recu/:numero, /paiement/retour,
//   /paiement/annule ; modale de paiement de l'espace client à deux parcours (Mobile Money en ligne
//   / encaissement au guichet, l'encaissement manuel est conservé) ; « copier le lien de paiement »
//   utilise le lien signé fourni par l'API (plus de construction d'URL côté front).
// SPEC §5.7 — voir SPECIFICATIONS.md MAJ 19/10/2026.
