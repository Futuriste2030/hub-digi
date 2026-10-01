/* Store mock Tickets — SPEC §7 : workflow Secrétariat avec aval.
   Endpoints DRF à venir : /tickets/ :id/qualify/ :id/request-approval/ :id/reply/ approvals/
   SLA : 24h première réponse, 72h résolution (Celery Beat + alerte Super Admin). */

export const STATUTS_TICKET = ['Nouveau', 'Qualifié', 'En attente aval', 'Approuvé', 'Répondu', 'Clos', 'Rejeté'];
export const TONS_TICKET = {
  Nouveau: 'info',
  Qualifié: 'alerte',
  'En attente aval': 'alerte',
  Approuvé: 'succes',
  Répondu: 'succes',
  Clos: 'neutre',
  Rejeté: 'erreur',
};
export const CATEGORIES_TICKET = ['Bug', 'Facturation', 'Devis', 'Projet', 'Com / Visuels', 'Autre'];
export const PRIORITES_TICKET = ['Basse', 'Normale', 'Haute', 'Urgente'];
export const TONS_PRIORITE = { Basse: 'neutre', Normale: 'info', Haute: 'alerte', Urgente: 'erreur' };
export const DEPTS_TICKET = ['Développement', 'Communication', 'Finance', 'Juridique', 'RH', 'Administration'];

export const TEMPLATES_REPONSE = [
  { id: 'accuse', libelle: 'Accusé de réception', corps: 'Bonjour,\n\nNous accusons réception de votre demande. Nos équipes reviendront vers vous sous 24h ouvrées.\n\nCordialement,\nLe Secrétariat — Digi Com & Technologies' },
  { id: 'resolution', libelle: 'Résolution confirmée', corps: 'Bonjour,\n\nVotre demande a été traitée. N hésitez pas à rouvrir ce ticket si le problème persiste.\n\nCordialement,\nLe Secrétariat — Digi Com & Technologies' },
  { id: 'info', libelle: 'Demande d information', corps: 'Bonjour,\n\nPour avancer sur votre dossier, pouvez-vous nous transmettre les éléments suivants : captures, références, échéances souhaitées ?\n\nCordialement,\nLe Secrétariat — Digi Com & Technologies' },
];

const H = 3600000;
const maintenant = Date.now();

let TICKETS = [
  {
    id: 't1', numero: 'TICK-2026-0341', client: 'Djama', clientId: 'djama',
    projet: 'App mobile Djama Pay', objet: 'Erreur 500 page paiement',
    message: 'Le paiement échoue après validation du panier. Captures jointes au ticket.',
    categorie: 'Bug', priorite: 'Urgente', dept: 'Développement',
    statut: 'Qualifié', creeLeTs: maintenant - 2 * H, delai: 'Il y a 2 h',
  },
  {
    id: 't2', numero: 'TICK-2026-0339', client: 'Moov Africa', clientId: 'moov-africa',
    projet: 'Campagne rentrée', objet: 'Visuel à valider',
    message: 'Trois visuels en attente de validation avant envoi au client.',
    categorie: 'Com / Visuels', priorite: 'Haute', dept: 'Communication',
    statut: 'En attente aval', creeLeTs: maintenant - 5 * H, delai: 'Il y a 5 h',
  },
  {
    id: 't3', numero: 'TICK-2026-0338', client: 'Orange Mali', clientId: 'orange-mali',
    projet: 'Site vitrine', objet: 'Texte de la page tarifs',
    message: 'Le client demande la mise à jour des tarifs fibre avant vendredi.',
    categorie: null, priorite: 'Normale', dept: null,
    statut: 'Nouveau', creeLeTs: maintenant - 1 * H, delai: 'Il y a 1 h',
  },
  {
    id: 't4', numero: 'TICK-2026-0335', client: 'Azalai Hotels', clientId: 'azalai',
    projet: 'Refonte e-commerce', objet: 'Facture illisible',
    message: 'Le client ne parvient pas à lire le PDF de sa facture.',
    categorie: 'Facturation', priorite: 'Normale', dept: 'Finance',
    statut: 'Répondu', creeLeTs: maintenant - 30 * H, delai: 'Hier',
  },
  {
    id: 't5', numero: 'TICK-2026-0331', client: 'Djama', clientId: 'djama',
    projet: 'App mobile Djama Pay', objet: 'Accès espace client',
    message: 'Le contact n arrive plus à se connecter à son espace client.',
    categorie: 'Projet', priorite: 'Basse', dept: 'Développement',
    statut: 'Approuvé', creeLeTs: maintenant - 26 * H, delai: 'Hier',
  },
  {
    id: 't6', numero: 'TICK-2026-0327', client: 'Moov Africa', clientId: 'moov-africa',
    projet: 'Campagne rentrée', objet: 'Facture en double ?',
    message: 'Le client signale un possible doublon de facturation sur l acompte.',
    messageRejet: 'Doublon avec TICK-2026-0325, déjà traité.',
    categorie: 'Facturation', priorite: 'Haute', dept: 'Finance',
    statut: 'Rejeté', creeLeTs: maintenant - 80 * H, delai: 'Il y a 3 j',
  },
];

let MESSAGES = [
  { id: 'm1', ticketId: 't1', auteur: 'Secrétariat', interne: true, date: 'Il y a 1 h', texte: 'Qualifié : bug critique, assigné au Développement. Demande d aval envoyée au Chef Dév.' },
  { id: 'm2', ticketId: 't2', auteur: 'Secrétariat', interne: true, date: 'Il y a 4 h', texte: 'Visuels relus, proposition de réponse préparée. En attente de l aval du Chef Com.' },
  { id: 'm3', ticketId: 't4', auteur: 'Secrétariat', interne: false, date: 'Hier', texte: 'Facture renvoyée en PDF haute définition. Confirmez-nous la bonne réception.' },
];

let APPROVALS = [
  { id: 'a1', ticketId: 't2', demandeur: 'Secrétariat', valideur: 'Chef Communication', decision: null, commentaire: '', note: 'Valider les 3 visuels avant envoi ?', date: 'Il y a 4 h' },
];

export const getTickets = () => TICKETS;
export const getTicket = (id) => TICKETS.find((t) => t.id === id);
export const getMessages = (ticketId) => MESSAGES.filter((m) => m.ticketId === ticketId);
export const getApprovals = (ticketId) => APPROVALS.filter((a) => a.ticketId === ticketId);

/* SLA : 24h première réponse (statuts précoces), 72h résolution (non clos/rejeté). */
export function slaTicket(t) {
  const heures = (Date.now() - t.creeLeTs) / H;
  const precoce = ['Nouveau', 'Qualifié', 'En attente aval'].includes(t.statut);
  const ouvert = !['Clos', 'Rejeté'].includes(t.statut);
  return {
    heures: Math.round(heures),
    reponseDepassee: precoce && heures > 24,
    resolutionDepassee: ouvert && heures > 72,
  };
}

export function qualifierTicket(id, { categorie, priorite, dept }) {
  TICKETS = TICKETS.map((t) => (t.id === id && t.statut === 'Nouveau'
    ? { ...t, categorie, priorite, dept, statut: 'Qualifié' }
    : t));
  MESSAGES = [...MESSAGES, {
    id: `m-${Date.now()}`, ticketId: id, auteur: 'Secrétariat', interne: true,
    date: 'À l instant', texte: `Qualifié : ${categorie}, priorité ${priorite}, assigné à ${dept}.`,
  }];
}

export function demanderAval(id, { valideur, note }) {
  TICKETS = TICKETS.map((t) => (t.id === id && ['Qualifié', 'Approuvé'].includes(t.statut)
    ? { ...t, statut: 'En attente aval' }
    : t));
  const a = {
    id: `a-${Date.now()}`, ticketId: id, demandeur: 'Secrétariat',
    valideur, decision: null, commentaire: '', note, date: 'À l instant',
  };
  APPROVALS = [a, ...APPROVALS];
  MESSAGES = [...MESSAGES, {
    id: `m-${Date.now()}-aval`, ticketId: id, auteur: 'Secrétariat', interne: true,
    date: 'À l instant', texte: `Aval demandé à ${valideur} : ${note}`,
  }];
  return a;
}

export function statuerAval(approvalId, decision, commentaire = '') {
  APPROVALS = APPROVALS.map((a) => (a.id === approvalId ? { ...a, decision, commentaire } : a));
  const aval = APPROVALS.find((a) => a.id === approvalId);
  if (!aval) return;
  if (decision === 'Approuvé') {
    TICKETS = TICKETS.map((t) => (t.id === aval.ticketId && t.statut === 'En attente aval' ? { ...t, statut: 'Approuvé' } : t));
  }
  MESSAGES = [...MESSAGES, {
    id: `m-${Date.now()}-dec`, ticketId: aval.ticketId, auteur: aval.valideur, interne: true,
    date: 'À l instant', texte: `Aval ${decision.toLowerCase()}${commentaire ? ` — ${commentaire}` : ''}.`,
  }];
}

export function repondreTicket(id, texte) {
  MESSAGES = [...MESSAGES, {
    id: `m-${Date.now()}-rep`, ticketId: id, auteur: 'Secrétariat', interne: false,
    date: 'À l instant', texte,
  }];
  TICKETS = TICKETS.map((t) => (t.id === id && ['Approuvé', 'Qualifié', 'Répondu'].includes(t.statut) ? { ...t, statut: 'Répondu' } : t));
}

export function cloreTicket(id) {
  TICKETS = TICKETS.map((t) => (t.id === id ? { ...t, statut: 'Clos' } : t));
}

export function rejeterTicket(id, motif) {
  TICKETS = TICKETS.map((t) => (t.id === id ? { ...t, statut: 'Rejeté', messageRejet: motif } : t));
}

export function rouvrirTicket(id) {
  TICKETS = TICKETS.map((t) => (t.id === id ? { ...t, statut: 'Qualifié' } : t));
}

/* Dépôt côté client (portail /espace) — SPEC §6 : réf auto, statut Nouveau,
   le Secrétariat qualifie ensuite. Backend : POST /api/v1/tickets/ (role=client). */
export function ajouterTicket({ client, clientId, projet, objet, message, categorie = 'Autre' }) {
  const max = TICKETS.reduce((m, t) => {
    const n = Number(String(t.numero).split('-')[2]) || 0;
    return Math.max(m, n);
  }, 0);
  const t = {
    id: `t-${Date.now()}`,
    numero: `TICK-2026-${String(max + 1).padStart(4, '0')}`,
    client,
    clientId,
    projet,
    objet: objet.trim(),
    message: message.trim(),
    categorie,
    priorite: 'Normale',
    dept: null,
    statut: 'Nouveau',
    creeLeTs: Date.now(),
    delai: 'À l instant',
  };
  TICKETS = [t, ...TICKETS];
  return t;
}
