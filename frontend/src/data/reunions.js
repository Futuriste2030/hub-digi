import { ajouterTache } from './kanban.js';
import { PROJETS } from './projets.js';

/* Store mock Réunions — SPEC §5.2 : ordres du jour, PV, décisions -> tâches assignées.
   Endpoints DRF à venir : /secretariat/reunions/ :id/pv/ :id/decisions/ :id/convert/ */

export const STATUTS_REUNION = ['Planifiée', 'PV en rédaction', 'Clôturée'];
export const TONS_REUNION = { Planifiée: 'info', 'PV en rédaction': 'alerte', Clôturée: 'succes' };
export const TRANSITIONS_REUNION = {
  Planifiée: ['PV en rédaction'],
  'PV en rédaction': ['Clôturée'],
  Clôturée: [],
};
export const STATUTS_DECISION = ['À faire', 'En cours', 'Terminée'];

let REUNIONS = [
  {
    id: 'r1',
    titre: 'Revue hebdo projets',
    date: '12/09/2026',
    heure: '09:00',
    lieu: 'Salle de réunion — ACI 2000',
    participants: ['Moussa Koné', 'Sékou Traoré', 'Awa Diallo'],
    statut: 'PV en rédaction',
    odj: [
      { id: 'o1', point: 'Avancement site vitrine Orange Mali (jalon 2)' },
      { id: 'o2', point: 'Bug critique Djama Pay — plan de correction' },
      { id: 'o3', point: 'Campagne rentrée Moov — visuels à valider' },
    ],
    pv: '<h2>Présents</h2><p>Moussa Koné, Sékou Traoré, Awa Diallo.</p><h2>Points abordés</h2><p>Jalon 2 livré à 80 %, reste la page tarifs. Bug paiement Djama reproduit en staging, correctif estimé à 2 jours.</p>',
    decisions: [
      { id: 'd1', texte: 'Livrer la page tarifs Orange Mali avant vendredi', responsable: 'Sékou Traoré', echeance: '19/09/2026', statut: 'En cours', tacheId: null },
      { id: 'd2', texte: 'Corriger le bug paiement Djama Pay en staging', responsable: 'Moussa Koné', echeance: '15/09/2026', statut: 'À faire', tacheId: null },
    ],
  },
  {
    id: 'r2',
    titre: 'Point finance mensuel',
    date: '18/09/2026',
    heure: '14:00',
    lieu: 'Bureau Finance',
    participants: ['Fatoumata Diarra', 'Super Admin'],
    statut: 'Planifiée',
    odj: [
      { id: 'o4', point: 'Relances factures impayées (FACT-2026-0039, FACT-2026-0036)' },
      { id: 'o5', point: 'Clôture fiche de paie août' },
    ],
    pv: '',
    decisions: [],
  },
];

export const getReunions = () => REUNIONS;
export const getReunion = (id) => REUNIONS.find((r) => r.id === id);
export const getProjetsOptions = () => PROJETS.map((p) => ({ id: p.id, nom: p.nom }));

export function ajouterReunion({ titre, date, heure, lieu, participants }) {
  const r = {
    id: `r-${Date.now()}`,
    titre: titre.trim(),
    date,
    heure,
    lieu: lieu.trim() || '—',
    participants: participants.split(',').map((p) => p.trim()).filter(Boolean),
    statut: 'Planifiée',
    odj: [],
    pv: '',
    decisions: [],
  };
  REUNIONS = [r, ...REUNIONS];
  return r;
}

export function majReunion(id, patch) {
  REUNIONS = REUNIONS.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function changerStatutReunion(id, statut) {
  const reunion = REUNIONS.find((r) => r.id === id);
  if (!reunion) return null;
  if (!(TRANSITIONS_REUNION[reunion.statut] ?? []).includes(statut)) return null;
  REUNIONS = REUNIONS.map((r) => (r.id === id ? { ...r, statut } : r));
  return REUNIONS.find((r) => r.id === id);
}

export function ajouterPointOdj(reunionId, point) {
  const p = { id: `o-${Date.now()}`, point: point.trim() };
  REUNIONS = REUNIONS.map((r) => (r.id === reunionId ? { ...r, odj: [...r.odj, p] } : r));
  return p;
}

export function ajouterDecision(reunionId, { texte, responsable, echeance }) {
  const d = { id: `d-${Date.now()}`, texte: texte.trim(), responsable: responsable.trim(), echeance, statut: 'À faire', tacheId: null };
  REUNIONS = REUNIONS.map((r) => (r.id === reunionId ? { ...r, decisions: [...r.decisions, d] } : r));
  return d;
}

export function statuerDecision(reunionId, decisionId, statut) {
  REUNIONS = REUNIONS.map((r) => (r.id === reunionId
    ? { ...r, decisions: r.decisions.map((d) => (d.id === decisionId ? { ...d, statut } : d)) }
    : r));
}

/* Convertit une décision en tâche Kanban assignée (SPEC §5.2). */
export function convertirDecisionEnTache(reunionId, decisionId, projetId) {
  const reunion = REUNIONS.find((r) => r.id === reunionId);
  const decision = reunion?.decisions.find((d) => d.id === decisionId);
  if (!decision || decision.tacheId) return null;
  const tache = ajouterTache({
    projetId,
    titre: decision.texte,
    statut: 'a_faire',
    priorite: 'Haute',
    assigne: decision.responsable,
  });
  REUNIONS = REUNIONS.map((r) => (r.id === reunionId
    ? { ...r, decisions: r.decisions.map((d) => (d.id === decisionId ? { ...d, tacheId: tache.id, statut: 'En cours' } : d)) }
    : r));
  return tache;
}
