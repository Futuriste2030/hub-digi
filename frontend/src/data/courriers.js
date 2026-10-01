/* Store mock Courriers — SPEC §5.2 : registre entrants/sortants numérotés.
   Endpoints DRF à venir : /secretariat/courriers/ :id/send/ :id/archive/
   Numérotation : SORT-YYYY-#### (sortants), ENT-YYYY-#### (entrants). */

export const SENS_COURRIER = ['Sortant', 'Entrant'];
export const STATUTS_SORTANT = ['Brouillon', 'Envoyé', 'Archivé'];
export const STATUTS_ENTRANT = ['Reçu', 'Traité', 'Archivé'];
export const TONS_COURRIER = { Brouillon: 'neutre', Envoyé: 'info', Reçu: 'info', Traité: 'succes', Archivé: 'neutre' };

export const TRANSITIONS_COURRIER = {
  Brouillon: ['Envoyé'],
  Envoyé: ['Archivé'],
  Reçu: ['Traité'],
  Traité: ['Archivé'],
  Archivé: [],
};

let COURRIERS = [
  {
    id: 'c1', numero: 'SORT-2026-0042', sens: 'Sortant',
    correspondant: 'Azalai Hotels', objet: 'Relance facture FACT-2026-0033',
    date: '05/09/2026', statut: 'Envoyé',
    contenu: '<p>Madame la Responsable,</p><p>Sauf erreur de notre part, la facture FACT-2026-0033 reste impayée à ce jour. Nous vous remercions de bien vouloir régulariser sous huitaine.</p><p>Cordialement,</p>',
  },
  {
    id: 'c2', numero: 'ENT-2026-0038', sens: 'Entrant',
    correspondant: 'Orange Mali', objet: 'Demande de mise à jour tarifs fibre',
    date: '08/09/2026', statut: 'Traité',
    contenu: '<p>Madame, Monsieur,</p><p>Par la présente, nous sollicitons la mise à jour des tarifs fibre de notre page avant vendredi.</p><p>Cordialement,</p>',
  },
  {
    id: 'c3', numero: 'ENT-2026-0039', sens: 'Entrant',
    correspondant: 'Moov Africa', objet: 'Invitation lancement campagne',
    date: '10/09/2026', statut: 'Reçu',
    contenu: '<p>Madame, Monsieur,</p><p>Nous avons l honneur de vous inviter au lancement de notre campagne de rentrée.</p><p>Cordialement,</p>',
  },
  {
    id: 'c4', numero: 'SORT-2026-0043', sens: 'Sortant',
    correspondant: 'Djama', objet: 'Proposition maintenance applicative',
    date: '11/09/2026', statut: 'Brouillon',
    contenu: '<p>Madame la Directrice,</p><p>Suite à nos échanges, veuillez trouver ci-joint notre proposition de maintenance applicative.</p><p>Cordialement,</p>',
  },
];

export const getCourriers = () => COURRIERS;
export const getCourrier = (id) => COURRIERS.find((c) => c.id === id);

function prochainNumero(sens) {
  const prefixe = sens === 'Sortant' ? 'SORT' : 'ENT';
  const max = COURRIERS.filter((c) => c.sens === sens).reduce((m, c) => {
    const n = Number(String(c.numero).split('-')[2]) || 0;
    return Math.max(m, n);
  }, 0);
  return `${prefixe}-2026-${String(max + 1).padStart(4, '0')}`;
}

export function ajouterCourrier({ sens, correspondant, objet, contenu }) {
  const c = {
    id: `c-${Date.now()}`,
    numero: prochainNumero(sens),
    sens,
    correspondant: correspondant.trim(),
    objet: objet.trim(),
    date: new Date().toLocaleDateString('fr-FR'),
    statut: sens === 'Sortant' ? 'Brouillon' : 'Reçu',
    contenu,
  };
  COURRIERS = [c, ...COURRIERS];
  return c;
}

export function majCourrier(id, patch) {
  COURRIERS = COURRIERS.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

/* Changement de statut contrôlé — refuse les transitions hors flux. */
export function changerStatutCourrier(id, statut) {
  const courrier = COURRIERS.find((c) => c.id === id);
  if (!courrier) return null;
  if (!(TRANSITIONS_COURRIER[courrier.statut] ?? []).includes(statut)) return null;
  COURRIERS = COURRIERS.map((c) => (c.id === id ? { ...c, statut } : c));
  return COURRIERS.find((c) => c.id === id);
}
