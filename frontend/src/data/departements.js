/* Référentiel des départements — périmètre visible (1er axe).
   BACKEND : GET /api/v1/departments/ (le Super Admin les administre). */

export const DEPARTEMENTS = [
  { id: 'administration', libelle: 'Administration' },
  { id: 'communication', libelle: 'Communication' },
  { id: 'developpement', libelle: 'Développement' },
  { id: 'finance', libelle: 'Finance' },
  { id: 'rh', libelle: 'RH' },
  { id: 'juridique', libelle: 'Juridique' },
  { id: 'secretariat', libelle: 'Secrétariat' },
  { id: 'direction', libelle: 'Direction' },
  { id: 'commercial', libelle: 'Clients / Commercial' },
  { id: 'espace-client', libelle: 'Espace client' },
];

export const libelleDepartement = (id) => DEPARTEMENTS.find((d) => d.id === id)?.libelle ?? id;
