/* Catalogue officiel des postes — SPEC §3 (mission postes/niveaux).
   Forme : { id, libelle, departement, niveau }. Le poste ne porte JAMAIS
   de permission en dur : tout passe par le niveau (voir niveaux.js).
   BACKEND : GET /api/v1/postes/?departement= — libellés jamais en dur en composant. */

export const POSTES = [
  /* Communication */
  { id: 'com-directeur', libelle: 'Directeur de la communication', departement: 'Communication', niveau: 4 },
  { id: 'com-chef-projet', libelle: 'Chef de projet com', departement: 'Communication', niveau: 3 },
  { id: 'com-community', libelle: 'Community manager', departement: 'Communication', niveau: 3 },
  { id: 'com-graphiste', libelle: 'Graphiste / Motion designer', departement: 'Communication', niveau: 3 },
  { id: 'com-redacteur', libelle: 'Rédacteur', departement: 'Communication', niveau: 2 },
  { id: 'com-stagiaire', libelle: 'Stagiaire com', departement: 'Communication', niveau: 1 },
  /* Développement */
  { id: 'dev-cto', libelle: 'CTO', departement: 'Développement', niveau: 5 },
  { id: 'dev-lead', libelle: 'Chef de projet / Lead dev', departement: 'Développement', niveau: 4 },
  { id: 'dev-fullstack', libelle: 'Développeur full-stack', departement: 'Développement', niveau: 3 },
  { id: 'dev-front', libelle: 'Développeur front', departement: 'Développement', niveau: 3 },
  { id: 'dev-back', libelle: 'Développeur back', departement: 'Développement', niveau: 3 },
  { id: 'dev-mobile', libelle: 'Développeur mobile', departement: 'Développement', niveau: 3 },
  { id: 'dev-qa', libelle: 'QA / Testeur', departement: 'Développement', niveau: 3 },
  { id: 'dev-uiux', libelle: 'Designer UI/UX', departement: 'Développement', niveau: 3 },
  { id: 'dev-stagiaire', libelle: 'Stagiaire dev', departement: 'Développement', niveau: 1 },
  /* Finance */
  { id: 'fin-directeur', libelle: 'Directeur financier', departement: 'Finance', niveau: 4 },
  { id: 'fin-comptable', libelle: 'Comptable', departement: 'Finance', niveau: 3 },
  { id: 'fin-facturation', libelle: 'Chargé de facturation', departement: 'Finance', niveau: 3 },
  { id: 'fin-recouvrement', libelle: 'Chargé de recouvrement', departement: 'Finance', niveau: 3 },
  { id: 'fin-caissier', libelle: 'Caissier', departement: 'Finance', niveau: 2 },
  { id: 'fin-stagiaire', libelle: 'Stagiaire finance', departement: 'Finance', niveau: 1 },
  /* RH */
  { id: 'rh-drh', libelle: 'DRH', departement: 'RH', niveau: 4 },
  { id: 'rh-charge', libelle: 'Chargé RH', departement: 'RH', niveau: 3 },
  { id: 'rh-recrutement', libelle: 'Chargé de recrutement', departement: 'RH', niveau: 3 },
  { id: 'rh-assistant', libelle: 'Assistant RH', departement: 'RH', niveau: 2 },
  { id: 'rh-stagiaire', libelle: 'Stagiaire RH', departement: 'RH', niveau: 1 },
  /* Juridique */
  { id: 'jur-directeur', libelle: 'Directeur juridique', departement: 'Juridique', niveau: 4 },
  { id: 'jur-juriste', libelle: 'Juriste', departement: 'Juridique', niveau: 3 },
  { id: 'jur-assistant', libelle: 'Assistant juridique', departement: 'Juridique', niveau: 2 },
  { id: 'jur-stagiaire', libelle: 'Stagiaire juridique', departement: 'Juridique', niveau: 1 },
  /* Secrétariat */
  { id: 'sec-direction', libelle: 'Secrétaire de direction', departement: 'Secrétariat', niveau: 4 },
  { id: 'sec-assistant', libelle: 'Assistant administratif', departement: 'Secrétariat', niveau: 3 },
  { id: 'sec-accueil', libelle: 'Accueil / Standardiste', departement: 'Secrétariat', niveau: 2 },
  { id: 'sec-stagiaire', libelle: 'Stagiaire secrétariat', departement: 'Secrétariat', niveau: 1 },
  /* Clients / Commercial */
  { id: 'com-directeur-co', libelle: 'Directeur commercial', departement: 'Clients / Commercial', niveau: 4 },
  { id: 'com-charge-cli', libelle: 'Chargé de clientèle', departement: 'Clients / Commercial', niveau: 3 },
  { id: 'com-prospecteur', libelle: 'Prospecteur', departement: 'Clients / Commercial', niveau: 2 },
  /* Direction */
  { id: 'dir-gerant', libelle: 'Gérant', departement: 'Direction', niveau: 5 },
  { id: 'dir-superadmin', libelle: 'Super administrateur', departement: 'Direction', niveau: 6 },
  /* Espace client */
  { id: 'ext-client', libelle: 'Client', departement: 'Espace client', niveau: 0 },
];

export const postesParDepartement = (departement) => POSTES.filter((p) => p.departement === departement);

export const trouverPoste = (id) => POSTES.find((p) => p.id === id) ?? null;
