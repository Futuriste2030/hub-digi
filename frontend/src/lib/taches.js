/* Badges et lignes d'estimation des tâches (SPEC Jira §1). */

export const PRIORITE_TON = { basse: 'neutre', normale: 'info', haute: 'alerte', critique: 'erreur' };
export const PRIORITE_LABEL = { basse: 'Basse', normale: 'Normale', haute: 'Haute', critique: 'Critique' };

export function estimationTexte(t) {
  const pts = t.estimation_points ?? '—';
  const hrs = t.estimation_heures ?? '—';
  return `${pts} pts · ${hrs} h estimées · ${t.temps_passe ?? 0} h passées`;
}
