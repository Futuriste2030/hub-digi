/* Catalogue des permissions — format ressource.action, groupées par module
   pour l'accordéon (étape 3). { code, module, libelle, description, sensible }.
   BACKEND : GET /api/v1/permissions/ (référentiel), effectives via /users/me/. */

export const MODULES = [
  { id: 'clients', libelle: 'Clients' },
  { id: 'com', libelle: 'Communication' },
  { id: 'projets', libelle: 'Projets & bugs' },
  { id: 'devis', libelle: 'Devis' },
  { id: 'factures', libelle: 'Factures' },
  { id: 'recus', libelle: 'Reçus' },
  { id: 'depenses', libelle: 'Dépenses' },
  { id: 'paie', libelle: 'Paie' },
  { id: 'rh', libelle: 'RH' },
  { id: 'conges', libelle: 'Congés' },
  { id: 'juridique', libelle: 'Juridique' },
  { id: 'tickets', libelle: 'Tickets' },
  { id: 'courriers', libelle: 'Courriers' },
  { id: 'reunions', libelle: 'Réunions' },
  { id: 'parametres', libelle: 'Paramètres' },
  { id: 'systeme', libelle: 'Système' },
];

export const PERMISSIONS = [
  /* Clients */
  { code: 'clients.read', module: 'clients', libelle: 'Voir les clients', description: 'Liste et fiches 360° (hors données financières).', sensible: false },
  { code: 'clients.create', module: 'clients', libelle: 'Créer un client', description: 'Nouvelle fiche société + contact.', sensible: false },
  { code: 'clients.update', module: 'clients', libelle: 'Modifier un client', description: 'Coordonnées, statut, tags.', sensible: false },
  { code: 'clients.delete', module: 'clients', libelle: 'Supprimer un client', description: 'Suppression définitive (traçée).', sensible: false },
  { code: 'clients.read_financier', module: 'clients', libelle: 'Voir le financier client', description: 'Devis, factures, impayés d un client.', sensible: true },
  /* Communication */
  { code: 'com.calendrier_read', module: 'com', libelle: 'Voir le calendrier', description: 'Calendrier éditorial multi-canal.', sensible: false },
  { code: 'com.post_create', module: 'com', libelle: 'Créer une publication', description: 'Brouillon daté avec pièces jointes.', sensible: false },
  { code: 'com.post_publier', module: 'com', libelle: 'Publier', description: 'Avancer jusqu à Publié.', sensible: false },
  { code: 'com.medias_upload', module: 'com', libelle: 'Uploader un média', description: 'Images, vidéos (lien), documents.', sensible: false },
  { code: 'com.medias_delete', module: 'com', libelle: 'Supprimer un média', description: 'Retrait de la bibliothèque.', sensible: false },
  { code: 'com.communique_publier', module: 'com', libelle: 'Publier un communiqué', description: 'Communiqués de presse.', sensible: false },
  /* Projets & bugs */
  { code: 'projets.read', module: 'projets', libelle: 'Voir les projets', description: 'Liste, Kanban, jalons, livrables.', sensible: false },
  { code: 'projets.create', module: 'projets', libelle: 'Créer un projet', description: 'Dépôt et tracker auto-générés.', sensible: false },
  { code: 'projets.archiver', module: 'projets', libelle: 'Archiver un projet', description: 'Clôture et archivage.', sensible: false },
  { code: 'taches.move_self', module: 'projets', libelle: 'Avancer ses tâches', description: 'Déplacer ses propres cartes Kanban.', sensible: false },
  { code: 'taches.move_all', module: 'projets', libelle: 'Gérer toutes les tâches', description: 'Assigner et déplacer toute carte.', sensible: false },
  { code: 'bugs.create', module: 'projets', libelle: 'Signaler un bug', description: 'Signalement manuel (source Manuelle).', sensible: false },
  { code: 'bugs.close', module: 'projets', libelle: 'Clore un bug', description: 'Avancer jusqu à Corrigé/Rejeté.', sensible: false },
  /* Devis */
  { code: 'devis.read', module: 'devis', libelle: 'Voir les devis', description: 'Liste et documents PDF.', sensible: false },
  { code: 'devis.create', module: 'devis', libelle: 'Créer un devis', description: 'Chiffrage multi-lignes.', sensible: false },
  { code: 'devis.valider', module: 'devis', libelle: 'Valider / convertir', description: 'Conversion en facture.', sensible: false },
  /* Factures */
  { code: 'factures.read', module: 'factures', libelle: 'Voir les factures', description: 'Liste et documents PDF.', sensible: false },
  { code: 'factures.create', module: 'factures', libelle: 'Créer une facture', description: 'Facturation manuelle.', sensible: false },
  { code: 'factures.emettre', module: 'factures', libelle: 'Émettre / envoyer', description: 'Template + PDF au client.', sensible: false },
  { code: 'factures.annuler', module: 'factures', libelle: 'Annuler une facture', description: 'Annulation traçée.', sensible: false },
  /* Reçus */
  { code: 'recus.create', module: 'recus', libelle: 'Encaisser (génère reçu)', description: 'Solder une facture, reçu auto.', sensible: false },
  /* Dépenses */
  { code: 'depenses.create', module: 'depenses', libelle: 'Saisir une dépense', description: 'Dépense par département.', sensible: false },
  { code: 'depenses.approuver', module: 'depenses', libelle: 'Approuver une dépense', description: 'Validation niveau chef.', sensible: false },
  /* Paie (sensible) */
  { code: 'paie.read', module: 'paie', libelle: 'Voir la paie', description: 'Fiches et montants de paie.', sensible: true },
  { code: 'paie.preparer', module: 'paie', libelle: 'Préparer la paie', description: 'Saisie des lignes mensuelles.', sensible: true },
  { code: 'paie.valider', module: 'paie', libelle: 'Clôturer la paie', description: 'Clôture + cachet requis.', sensible: true },
  /* RH */
  { code: 'rh.employes_read', module: 'rh', libelle: 'Voir les employés', description: 'Trombinoscope et fiches.', sensible: false },
  { code: 'rh.employes_edit', module: 'rh', libelle: 'Modifier un employé', description: 'Fiches et documents.', sensible: false },
  { code: 'rh.contrat_read', module: 'rh', libelle: 'Voir les contrats', description: 'Contrats de travail.', sensible: false },
  { code: 'rh.contrat_generer', module: 'rh', libelle: 'Générer un contrat', description: 'Modèle pré-rempli + PDF.', sensible: false },
  { code: 'rh.recrutement_read', module: 'rh', libelle: 'Voir le recrutement', description: 'Offres et candidatures du site.', sensible: false },
  { code: 'rh.recrutement_gerer', module: 'rh', libelle: 'Gérer le recrutement', description: 'Statuer les candidats.', sensible: false },
  /* Congés */
  { code: 'conges.create_self', module: 'conges', libelle: 'Demander un congé', description: 'Demande pour soi-même.', sensible: false },
  { code: 'conges.valider_departement', module: 'conges', libelle: 'Valider (son département)', description: 'Accepter / refuser les demandes du dept.', sensible: false },
  { code: 'conges.valider_tous', module: 'conges', libelle: 'Valider (tous)', description: 'Validation transverse.', sensible: false },
  /* Juridique */
  { code: 'juridique.contrats_read', module: 'juridique', libelle: 'Voir les contrats', description: 'Liste et aperçu PDF.', sensible: false },
  { code: 'juridique.contrats_redact', module: 'juridique', libelle: 'Rédiger un contrat', description: 'Éditeur + modèles.', sensible: false },
  { code: 'juridique.contrats_valider', module: 'juridique', libelle: 'Valider / signer', description: 'Avancer jusqu à Signé.', sensible: false },
  { code: 'juridique.litiges_read', module: 'juridique', libelle: 'Voir les litiges', description: 'Dossiers et rapports.', sensible: false },
  { code: 'juridique.litiges_gerer', module: 'juridique', libelle: 'Gérer les litiges', description: 'Résolution et classement.', sensible: true },
  /* Tickets */
  { code: 'tickets.create', module: 'tickets', libelle: 'Créer un ticket', description: 'Dépôt côté client ou interne.', sensible: false },
  { code: 'tickets.assign', module: 'tickets', libelle: 'Qualifier / assigner', description: 'Catégorie, priorité, département.', sensible: false },
  { code: 'tickets.close', module: 'tickets', libelle: 'Répondre / clore', description: 'Réponse client et clôture.', sensible: false },
  /* Courriers */
  { code: 'courriers.read', module: 'courriers', libelle: 'Voir les courriers', description: 'Registre entrants/sortants.', sensible: false },
  { code: 'courriers.create', module: 'courriers', libelle: 'Créer un courrier', description: 'Rédaction + numérotation auto.', sensible: false },
  { code: 'courriers.traiter', module: 'courriers', libelle: 'Envoyer / traiter', description: 'Envoi, traitement, archivage.', sensible: false },
  /* Réunions */
  { code: 'reunions.read', module: 'reunions', libelle: 'Voir les réunions', description: 'ODJ, PV, décisions.', sensible: false },
  { code: 'reunions.create', module: 'reunions', libelle: 'Planifier une réunion', description: 'Convocations auto.', sensible: false },
  { code: 'reunions.pv_rediger', module: 'reunions', libelle: 'Rédiger le PV', description: 'PV + décisions -> tâches.', sensible: false },
  /* Paramètres (sensible) */
  { code: 'parametres.read', module: 'parametres', libelle: 'Voir les paramètres', description: 'Société, en-têtes.', sensible: true },
  { code: 'parametres.utilisateurs_gerer', module: 'parametres', libelle: 'Gérer les utilisateurs', description: 'Création, rôles, activation.', sensible: true },
  /* Système — écrire un mail : droit de base de tout interne (niveaux 1→6). */
  { code: 'systeme.mails_write', module: 'systeme', libelle: 'Écrire un e-mail', description: 'Envoi via l identité de son département.', sensible: false },
];

export const permissionsParModule = (module) => PERMISSIONS.filter((p) => p.module === module);

export const trouverPermission = (code) => PERMISSIONS.find((p) => p.code === code) ?? null;
