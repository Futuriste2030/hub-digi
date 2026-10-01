import { PROJETS } from './projets.js';

/* Store mock partagé Kanban + Bugs — les endpoints DRF prendront le relais :
   GET /api/v1/projects/:id/tasks/ et POST /api/v1/bugs/:numero/convert/ */

let TACHES = PROJETS.flatMap((p) =>
  p.taches.map((t) => ({ ...t, projetId: p.id, projet: p.nom, client: p.client })),
);

let BUGS = PROJETS.flatMap((p) =>
  p.bugs.map((b) => ({ ...b, projetId: p.id, projet: p.nom, client: p.client, converti: false })),
);

export const STATUTS_BUG = ['Nouveau', 'Confirmé', 'En cours', 'Corrigé', 'Rejeté'];

const PRIORITES = {
  Basse: 'neutre',
  Normale: 'info',
  Haute: 'alerte',
  Critique: 'erreur',
};
export const LISTE_PRIORITES = Object.keys(PRIORITES);

export const getTachesProjet = (projetId) => TACHES.filter((t) => t.projetId === projetId);
export const getToutesTaches = () => TACHES;

export function ajouterTache({ projetId, titre, statut, priorite = 'Normale', assigne = 'Non assigné' }) {
  const p = PROJETS.find((x) => x.id === projetId) ?? PROJETS[0];
  const tache = {
    id: `t-${Date.now()}`,
    titre,
    statut,
    assigne,
    temps: '—',
    priorite,
    ton: PRIORITES[priorite] || 'info',
    projetId: p.id,
    projet: p.nom,
    client: p.client,
  };
  TACHES = [tache, ...TACHES];
  return tache;
}

export function deplacerTache(id, statut) {
  TACHES = TACHES.map((t) => (t.id === id ? { ...t, statut } : t));
}

export const getBugsProjet = (projetId) => BUGS.filter((b) => b.projetId === projetId);
export const getTousBugs = () => BUGS;

export function changerStatutBug(numero, statut) {
  BUGS = BUGS.map((b) => (b.numero === numero ? { ...b, statut } : b));
}

/* Sources bug (SPEC §9) : « Tracker auto » = remontée tracker.js du site client
   (window.onerror -> POST /bugs/report/), « Manuel » = signalement humain
   (widget du site, équipe ou client). Backend : champ source auto-rempli. */
export const SOURCES_BUG = ['Tracker auto', 'Manuel'];

export function signalerBug({ projetId, titre, gravite }) {
  const numeros = BUGS.map((b) => Number(String(b.numero).split('-')[2]) || 0);
  const max = numeros.length > 0 ? Math.max(...numeros) : 0;
  const p = PROJETS.find((x) => x.id === projetId) ?? PROJETS[0];
  const tons = { Critique: 'erreur', Majeure: 'alerte', Mineure: 'info' };
  const b = {
    numero: `BUG-2026-${String(max + 1).padStart(4, '0')}`,
    titre: titre.trim(),
    gravite,
    ton: tons[gravite] || 'info',
    statut: 'Nouveau',
    source: 'Manuel',
    converti: false,
    projetId: p.id,
    projet: p.nom,
    client: p.client,
  };
  BUGS = [b, ...BUGS];
  return b;
}

export function convertirBugEnTache(numero) {
  const bug = BUGS.find((b) => b.numero === numero);
  if (!bug || bug.converti) return null;
  BUGS = BUGS.map((b) => (b.numero === numero ? { ...b, statut: 'En cours', converti: true } : b));
  return ajouterTache({
    projetId: bug.projetId,
    titre: `Corriger : ${bug.titre}`,
    statut: 'a_faire',
    priorite: bug.gravite === 'Critique' || bug.gravite === 'Majeure' ? 'Haute' : 'Normale',
  });
}
