/* Échelle hiérarchique 0 → 6 — SPEC §3 (mission postes/niveaux).
   Le niveau porte la profondeur d'action ; le poste n'est qu'une étiquette.
   Tons : variables --niveau-0…6 déclarées dans src/index.css (:root).
   BACKEND : GET /api/v1/niveaux/ (référentiel quasi-statique, cachable). */

export const NIVEAUX = [
  { niveau: 0, libelle: 'Externe / Client', variable: '--niveau-0' },
  { niveau: 1, libelle: 'Stagiaire / Apprenti', variable: '--niveau-1' },
  { niveau: 2, libelle: 'Assistant / Junior', variable: '--niveau-2' },
  { niveau: 3, libelle: 'Chargé / Confirmé', variable: '--niveau-3' },
  { niveau: 4, libelle: 'Responsable / Chef', variable: '--niveau-4' },
  { niveau: 5, libelle: 'Directeur', variable: '--niveau-5' },
  { niveau: 6, libelle: 'Super admin', variable: '--niveau-6' },
];

export const libelleNiveau = (n) => NIVEAUX.find((x) => x.niveau === n)?.libelle ?? '—';

/* Phrases d'implication — select « Niveau de référence » (poste personnalisé). */
export const IMPLICATIONS_NIVEAU = {
  1: 'Exécute des tâches encadrées, ne valide rien, ne voit que son périmètre.',
  2: 'Exécute en autonomie, propose, ne publie ni ne valide.',
  3: 'Crée, publie et gère son périmètre ; validation du chef requise pour le sensible.',
  4: 'Valide et assigne dans son département ; donne les avals.',
  5: 'Transverse sur son pôle, valide le sensible hors Super admin.',
  6: 'Tous les accès, y compris paramètres et utilisateurs.',
};

/* Permissions dérivées du niveau (ressource.action). Règle d'or : AUCUNE
   permission sensible cochée par défaut, même au niveau 6 — le niveau 6
   hérite de tout le non-sensible, le sensible reste à cocher à la main.
   BACKEND : GET /api/v1/niveaux/:n/permissions/ (ou calculé côté permissionsEffectives). */
export const PERMISSIONS_PAR_NIVEAU = {
  0: ['projets.read', 'devis.read', 'factures.read', 'tickets.create'],
  1: [
    'clients.read', 'com.calendrier_read', 'projets.read', 'taches.move_self',
    'bugs.create', 'devis.read', 'factures.read', 'tickets.create',
    'courriers.read', 'reunions.read', 'conges.create_self', 'systeme.mails_write',
  ],
  2: [
    'clients.read', 'com.calendrier_read', 'com.post_create', 'com.medias_upload',
    'projets.read', 'taches.move_self', 'bugs.create', 'devis.read', 'devis.create',
    'factures.read', 'factures.create', 'recus.create', 'depenses.create',
    'rh.employes_read', 'rh.contrat_read', 'rh.recrutement_read', 'tickets.create',
    'courriers.read', 'courriers.create', 'reunions.read', 'reunions.create',
    'conges.create_self', 'systeme.mails_write',
  ],
  3: [
    'clients.read', 'com.calendrier_read', 'com.post_create', 'com.post_publier',
    'com.medias_upload', 'com.medias_delete', 'com.communique_publier',
    'projets.read', 'projets.create', 'taches.move_self', 'taches.move_all',
    'bugs.create', 'bugs.close', 'devis.read', 'devis.create', 'devis.valider',
    'factures.read', 'factures.create', 'factures.emettre',
    'recus.create', 'depenses.create',
    'rh.employes_read', 'rh.employes_edit', 'rh.contrat_read', 'rh.contrat_generer',
    'rh.recrutement_read', 'rh.recrutement_gerer',
    'conges.create_self', 'tickets.create', 'tickets.close',
    'courriers.read', 'courriers.create', 'courriers.traiter',
    'reunions.read', 'reunions.create', 'reunions.pv_rediger', 'systeme.mails_write',
    'juridique.contrats_read', 'juridique.contrats_redact', 'juridique.litiges_read',
  ],
  4: [
    'clients.read', 'com.calendrier_read', 'com.post_create', 'com.post_publier',
    'com.medias_upload', 'com.medias_delete', 'com.communique_publier',
    'projets.read', 'projets.create', 'projets.archiver',
    'taches.move_self', 'taches.move_all', 'bugs.create', 'bugs.close',
    'devis.read', 'devis.create', 'devis.valider',
    'factures.read', 'factures.create', 'factures.emettre', 'factures.annuler',
    'recus.create', 'depenses.create', 'depenses.approuver',
    'rh.employes_read', 'rh.employes_edit', 'rh.contrat_read', 'rh.contrat_generer',
    'rh.recrutement_read', 'rh.recrutement_gerer',
    'conges.create_self', 'conges.valider_departement',
    'tickets.create', 'tickets.assign', 'tickets.close',
    'courriers.read', 'courriers.create', 'courriers.traiter',
    'reunions.read', 'reunions.create', 'reunions.pv_rediger', 'systeme.mails_write',
    'juridique.contrats_read', 'juridique.contrats_redact', 'juridique.contrats_valider',
    'juridique.litiges_read',
  ],
  5: [
    'clients.read', 'clients.create', 'clients.update', 'clients.delete',
    'com.calendrier_read', 'com.post_create', 'com.post_publier',
    'com.medias_upload', 'com.medias_delete', 'com.communique_publier',
    'projets.read', 'projets.create', 'projets.archiver',
    'taches.move_self', 'taches.move_all', 'bugs.create', 'bugs.close',
    'devis.read', 'devis.create', 'devis.valider',
    'factures.read', 'factures.create', 'factures.emettre', 'factures.annuler',
    'recus.create', 'depenses.create', 'depenses.approuver',
    'rh.employes_read', 'rh.employes_edit', 'rh.contrat_read', 'rh.contrat_generer',
    'rh.recrutement_read', 'rh.recrutement_gerer',
    'conges.create_self', 'conges.valider_departement', 'conges.valider_tous',
    'tickets.create', 'tickets.assign', 'tickets.close',
    'courriers.read', 'courriers.create', 'courriers.traiter',
    'reunions.read', 'reunions.create', 'reunions.pv_rediger', 'systeme.mails_write',
    'juridique.contrats_read', 'juridique.contrats_redact', 'juridique.contrats_valider',
    'juridique.litiges_read',
  ],
  /* Niveau 6 = tout le non-sensible (identique aux défauts du niveau 5 ici :
     aucun sensible n'est dérivé, cocher à la main à l'étape 3 si besoin). */
  6: [
    'clients.read', 'clients.create', 'clients.update', 'clients.delete',
    'com.calendrier_read', 'com.post_create', 'com.post_publier',
    'com.medias_upload', 'com.medias_delete', 'com.communique_publier',
    'projets.read', 'projets.create', 'projets.archiver',
    'taches.move_self', 'taches.move_all', 'bugs.create', 'bugs.close',
    'devis.read', 'devis.create', 'devis.valider',
    'factures.read', 'factures.create', 'factures.emettre', 'factures.annuler',
    'recus.create', 'depenses.create', 'depenses.approuver',
    'rh.employes_read', 'rh.employes_edit', 'rh.contrat_read', 'rh.contrat_generer',
    'rh.recrutement_read', 'rh.recrutement_gerer',
    'conges.create_self', 'conges.valider_departement', 'conges.valider_tous',
    'tickets.create', 'tickets.assign', 'tickets.close',
    'courriers.read', 'courriers.create', 'courriers.traiter',
    'reunions.read', 'reunions.create', 'reunions.pv_rediger', 'systeme.mails_write',
    'juridique.contrats_read', 'juridique.contrats_redact', 'juridique.contrats_valider',
    'juridique.litiges_read',
  ],
};
