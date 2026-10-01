/* Comptes de démo — 14 utilisateurs couvrant les 9 périmètres + niveaux 0→6,
   dont 2 à poste personnalisé (posteId: null + posteLibre).
   Forme : { id, prenom, nom, email, telephone, photo, entree, departement,
             posteId, posteLibre, niveau, permissionsAjustees: {code: bool}, statut }
   - posteId = poste du catalogue ; posteLibre = libellé coutume (affichage).
   - permissionsAjustees = overrides manuels (étape 3) : true = octroyée,
     false = retirée malgré le niveau.
   BACKEND : GET /api/v1/users/ — chaque fonction ci-dessous deviendra un appel :
     getUtilisateurs -> GET /users/ | getUtilisateur -> GET /users/:id/
     creerUtilisateur -> POST /users/ | majPermissions -> PATCH /users/:id/permissions/
     promouvoirPoste -> POST /postes/ | fusionnerPoste -> POST /postes/merge/ */

const U = (u) => ({ photo: null, permissionsAjustees: {}, statut: 'Actif', ...u });

let UTILISATEURS = [
  U({ id: 'u-aziz', prenom: 'Aziz', nom: 'Traoré', email: 'a.traore@digicom.ml', telephone: '+223 70 00 00 01', entree: '02/01/2023', departement: 'Direction', posteId: 'dir-superadmin', niveau: 6 }),
  U({ id: 'u-aicha', prenom: 'Aïcha', nom: 'Koné', email: 'a.kone@digicom.ml', telephone: '+223 70 00 00 02', entree: '15/03/2023', departement: 'Direction', posteId: 'dir-gerant', niveau: 5 }),
  U({ id: 'u-sekou', prenom: 'Sékou', nom: 'Traoré', email: 's.traore@digicom.ml', telephone: '+223 70 00 00 03', entree: '01/03/2024', departement: 'Développement', posteId: 'dev-lead', niveau: 4 }),
  U({ id: 'u-ibrahim', prenom: 'Ibrahim', nom: 'Touré', email: 'i.toure@digicom.ml', telephone: '+223 70 00 00 04', entree: '10/06/2024', departement: 'Développement', posteId: 'dev-back', niveau: 3 }),
  U({ id: 'u-ousmane', prenom: 'Ousmane', nom: 'Bah', email: 'o.bah@digicom.ml', telephone: '+223 70 00 00 05', entree: '05/02/2025', departement: 'Développement', posteId: null, posteLibre: 'DevOps', niveau: 3, permissionsAjustees: { 'projets.archiver': true } }),
  U({ id: 'u-youssouf', prenom: 'Youssouf', nom: 'Maïga', email: 'y.maiga@digicom.ml', telephone: '+223 70 00 00 06', entree: '01/09/2026', departement: 'Développement', posteId: 'dev-stagiaire', niveau: 1 }),
  U({ id: 'u-awa', prenom: 'Awa', nom: 'Diallo', email: 'a.diallo@digicom.ml', telephone: '+223 70 00 00 07', entree: '10/06/2024', departement: 'Communication', posteId: 'com-community', niveau: 3 }),
  U({ id: 'u-kadidiatou', prenom: 'Kadidiatou', nom: 'Sow', email: 'k.sow@digicom.ml', telephone: '+223 70 00 00 08', entree: '12/01/2025', departement: 'Communication', posteId: null, posteLibre: 'Brand Strategist', niveau: 3, permissionsAjustees: { 'com.communique_publier': false } }),
  U({ id: 'u-fatoumata', prenom: 'Fatoumata', nom: 'Diarra', email: 'f.diarra@digicom.ml', telephone: '+223 70 00 00 09', entree: '05/02/2024', departement: 'Finance', posteId: 'fin-directeur', niveau: 4 }),
  U({ id: 'u-boubacar', prenom: 'Boubacar', nom: 'Dembélé', email: 'b.dembele@digicom.ml', telephone: '+223 70 00 00 10', entree: '20/05/2024', departement: 'Finance', posteId: 'fin-caissier', niveau: 2, statut: 'Désactivé' }),
  U({ id: 'u-mariam', prenom: 'Mariam', nom: 'Cissé', email: 'm.cisse@digicom.ml', telephone: '+223 70 00 00 11', entree: '01/07/2026', departement: 'RH', posteId: 'rh-charge', niveau: 3 }),
  U({ id: 'u-modibo', prenom: 'Modibo', nom: 'Sangaré', email: 'm.sangare@digicom.ml', telephone: '+223 70 00 00 12', entree: '12/09/2023', departement: 'Juridique', posteId: 'jur-juriste', niveau: 3 }),
  U({ id: 'u-nana', prenom: 'Nana', nom: 'Traoré', email: 'n.traore@digicom.ml', telephone: '+223 70 00 00 13', entree: '08/04/2024', departement: 'Secrétariat', posteId: 'sec-assistant', niveau: 3 }),
  U({ id: 'u-cheikh', prenom: 'Cheikh', nom: 'Ndiaye', email: 'c.ndiaye@sonatel.sn', telephone: '+221 33 000 11 22', entree: '01/09/2026', departement: 'Clients / Commercial', posteId: 'com-charge-cli', niveau: 3 }),
];

export const getUtilisateurs = () => UTILISATEURS;

export const getUtilisateur = (id) => UTILISATEURS.find((u) => u.id === id) ?? null;

/* Libellé d'affichage du poste : catalogue ou coutume. */
import { trouverPoste } from './postes.js';

export const libellePosteUtilisateur = (u) => {
  if (!u) return '—';
  if (u.posteId) return trouverPoste(u.posteId)?.libelle ?? u.posteLibre ?? '—';
  return u.posteLibre ?? '—';
};

export const estPostePersonnalise = (u) => !u?.posteId;

export function creerUtilisateur(payload) {
  const u = U({ id: `u-${Date.now()}`, statut: 'Actif', ...payload });
  UTILISATEURS = [u, ...UTILISATEURS];
  return u;
}

export function majPermissions(id, permissionsAjustees) {
  UTILISATEURS = UTILISATEURS.map((u) => (u.id === id ? { ...u, permissionsAjustees } : u));
}

export function majStatutUtilisateur(id, statut) {
  UTILISATEURS = UTILISATEURS.map((u) => (u.id === id ? { ...u, statut } : u));
}

/* Reset mot de passe mock (toast) — BACKEND : POST /users/:id/reset-password/. */
export function resetMdpUtilisateur() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let mdp = '';
  const tirage = new Uint32Array(10);
  crypto.getRandomValues(tirage);
  for (let i = 0; i < 10; i++) mdp += alphabet[tirage[i] % alphabet.length];
  return mdp;
}
