import { CLIENTS } from './clients.js';
import { lienPaiementFacture } from '../lib/paiement.js';

/* Store mock Finance — endpoints DRF à venir :
   /finance/quotes/ /invoices/ /receipts/ /expenses/ + webhook passerelle.
   lienPaiement vide tant que VITE_PAIEMENT_ACTIF=false (pas de lien mort). */

export const nombre = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 0;

const lignesDe = (f) => [{ description: f.objet, quantite: 1, montant: nombre(f.montant) }];

let FACTURES = CLIENTS.flatMap((c) =>
  c.factures.map((f) => ({
    ...f,
    client: c.societe,
    clientId: c.id,
    clientEmail: c.email,
    lignes: lignesDe(f),
    lienPaiement: lienPaiementFacture(f.numero),
  })),
);

let RECUS = CLIENTS.flatMap((c) =>
  c.recus.map((r) => {
    const f = c.factures.find((x) => x.numero === r.facture);
    return {
      ...r,
      client: c.societe,
      clientId: c.id,
      clientEmail: c.email,
      moyen: 'Virement',
      refTransaction: `VIR-${r.numero.slice(-4)}-2026`,
      factureStatut: 'Payée',
      objet: f?.objet ?? `Règlement ${r.facture}`,
      lignes: f ? lignesDe(f) : [{ description: `Règlement ${r.facture}`, quantite: 1, montant: nombre(r.montant) }],
    };
  }),
);

let DEVIS = [
  { numero: 'DEV-2026-011', client: 'Sonatel', clientId: 'sonatel', objet: 'Refonte site vitrine', montant: '4 800 000 F', statut: 'En attente', ton: 'alerte', date: '01/09/2026', validite: '01/10/2026', lignes: [{ description: 'Refonte site vitrine — forfait', quantite: 1, montant: 4800000 }] },
  { numero: 'DEV-2026-010', client: 'Azalai Hotels', clientId: 'azalai', objet: 'Maintenance T4', montant: '600 000 F', statut: 'Accepté', ton: 'succes', date: '22/08/2026', validite: '22/09/2026', lignes: [{ description: 'Maintenance T4 — forfait trimestriel', quantite: 1, montant: 600000 }] },
  { numero: 'DEV-2026-009', client: 'Djama', clientId: 'djama', objet: 'Formation équipe', montant: '350 000 F', statut: 'Refusé', ton: 'erreur', date: '10/08/2026', validite: '10/09/2026', lignes: [{ description: 'Formation équipe — 2 jours', quantite: 1, montant: 350000 }] },
];

let DEPENSES = [
  { id: 'd1', date: '01/09/2026', libelle: 'Loyer bureau ACI 2000', departement: 'Administration', montant: 500000, moyen: 'Virement' },
  { id: 'd2', date: '03/09/2026', libelle: 'Fibre + électricité', departement: 'Administration', montant: 150000, moyen: 'Espèces' },
  { id: 'd3', date: '05/09/2026', libelle: 'Matériel tournage', departement: 'Communication', montant: 850000, moyen: 'Virement' },
  { id: 'd4', date: '06/09/2026', libelle: 'Licences Adobe', departement: 'Développement', montant: 120000, moyen: 'Carte' },
  { id: 'd5', date: '08/09/2026', libelle: 'Carburant', departement: 'Administration', montant: 95000, moyen: 'Espèces' },
];

export const STATUTS_DEVIS = ['En attente', 'Accepté', 'Refusé'];
export const STATUTS_FACTURE = ['Brouillon', 'Envoyée', 'Impayée', 'Payée'];
export const TONS_FACTURE = { Brouillon: 'neutre', Envoyée: 'info', Impayée: 'erreur', Payée: 'succes' };

export const getFactures = () => FACTURES;
export const getFacture = (numero) => FACTURES.find((f) => f.numero === numero);
export const getRecus = () => RECUS;
export const getRecu = (numero) => RECUS.find((r) => r.numero === numero);
export const getDevis = () => DEVIS;
export const getDepenses = () => DEPENSES;

export function ajouterDevis({ clientId, objet, montant, lignes, validite }) {
  const c = CLIENTS.find((x) => x.id === clientId) ?? CLIENTS[0];
  const numero = `DEV-2026-${String(12 + DEVIS.length).padStart(3, '0')}`;
  const d = {
    numero,
    client: c.societe,
    clientId: c.id,
    objet,
    montant: `${Number(montant).toLocaleString('fr-FR')} F`,
    statut: 'En attente',
    ton: 'alerte',
    date: new Date().toLocaleDateString('fr-FR'),
    validite: validite || new Date(Date.now() + 30 * 86400000).toLocaleDateString('fr-FR'),
    lignes: (lignes || []).map((l) => ({ description: l.description, quantite: Number(l.quantite) || 1, montant: Number(l.montant) })),
  };
  DEVIS = [d, ...DEVIS];
  return d;
}

export function convertirDevis(numero) {
  const d = DEVIS.find((x) => x.numero === numero);
  if (!d || d.statut === 'Refusé') return null;
  DEVIS = DEVIS.map((x) => (x.numero === numero ? { ...x, statut: 'Accepté', ton: 'succes' } : x));
  const f = {
    numero: d.numero.replace('DEV', 'FACT'),
    objet: d.objet,
    montant: d.montant,
    statut: 'Envoyée',
    ton: 'info',
    date: new Date().toLocaleDateString('fr-FR'),
    client: d.client,
    clientId: d.clientId,
    clientEmail: CLIENTS.find((x) => x.id === d.clientId)?.email ?? '',
    lignes: d.lignes && d.lignes.length > 0 ? d.lignes : [{ description: d.objet, quantite: 1, montant: nombre(d.montant) }],
    lienPaiement: lienPaiementFacture(d.numero.replace('DEV', 'FACT')),
  };
  FACTURES = [f, ...FACTURES];
  return f;
}

/* Refus devis côté client (portail) — SPEC §6 : statut Rejeté + notif admin.
   Backend : POST /espace/devis/:numero/rejeter/ */
export function rejeterDevis(numero) {
  const d = DEVIS.find((x) => x.numero === numero);
  if (!d || d.statut !== 'En attente') return null;
  DEVIS = DEVIS.map((x) => (x.numero === numero ? { ...x, statut: 'Refusé', ton: 'erreur' } : x));
  return DEVIS.find((x) => x.numero === numero);
}

/* Simulation du webhook passerelle — même contrat que POST /finance/webhook/. */
export function solderFacture(numero, moyen = 'Mobile Money') {
  const f = FACTURES.find((x) => x.numero === numero);
  if (!f || f.statut === 'Payée') return null;
  FACTURES = FACTURES.map((x) => (x.numero === numero ? { ...x, statut: 'Payée', ton: 'succes' } : x));
  const recu = {
    numero: `RECU-2026-${String(32 + RECUS.length).padStart(4, '0')}`,
    facture: numero,
    objet: f.objet,
    montant: f.montant,
    date: new Date().toLocaleDateString('fr-FR'),
    client: f.client,
    clientId: f.clientId,
    clientEmail: f.clientEmail,
    moyen,
    refTransaction: `${moyen === 'Virement' ? 'VIR' : moyen === 'Espèces' ? 'ESP' : 'MM'}-${String(Date.now()).slice(-6)}`,
    factureStatut: 'Payée',
    lignes: f.lignes.map((l) => ({ ...l })),
  };
  RECUS = [recu, ...RECUS];
  return { facture: { ...f, statut: 'Payée' }, recu };
}

export function ajouterDepense({ date, libelle, departement, montant, moyen }) {
  const [a, m, j] = date.split('-');
  const d = { id: `d-${Date.now()}`, date: `${j}/${m}/${a}`, libelle, departement, montant: Number(montant), moyen };
  DEPENSES = [d, ...DEPENSES];
  return d;
}

/* Création manuelle : devis accepté, commande directe ou régularisation. */
export function ajouterFacture({ clientId, lignes, date }) {
  const c = CLIENTS.find((x) => x.id === clientId) ?? CLIENTS[0];
  const max = FACTURES.reduce((m, f) => {
    const n = Number(String(f.numero).split('-')[2]) || 0;
    return Math.max(m, n);
  }, 41);
  const numero = `FACT-2026-${String(max + 1).padStart(4, '0')}`;
  const lignesPropres = lignes
    .filter((l) => l.description.trim() !== '' && Number(l.montant) > 0)
    .map((l) => ({ description: l.description.trim(), quantite: Math.max(1, Number(l.quantite) || 1), montant: Number(l.montant) }));
  const total = lignesPropres.reduce((s, l) => s + l.montant * l.quantite, 0);
  const f = {
    numero,
    objet: lignesPropres[0]?.description ?? 'Prestation',
    montant: `${total.toLocaleString('fr-FR')} F`,
    statut: 'Brouillon',
    ton: 'neutre',
    date: date ? (() => { const [a, m, j] = date.split('-'); return `${j}/${m}/${a}`; })() : new Date().toLocaleDateString('fr-FR'),
    client: c.societe,
    clientId: c.id,
    clientEmail: c.email,
    lignes: lignesPropres,
    lienPaiement: lienPaiementFacture(numero),
  };
  FACTURES = [f, ...FACTURES];
  return f;
}

/* Paie employés — fiches mensuelles vierges à en-têtes fixes.
   Maquette : GET /api/v1/finance/paie/ + PATCH lignes. */
export const STATUTS_PAIE = ['En attente', 'Payé'];
export const DEPARTEMENTS_PAIE = ['Administration', 'Communication', 'Développement', 'RH', 'Juridique', 'Finance'];
export const COLONNES_PAIE = [
  { id: 'departement', libelle: 'Département', type: 'select', options: DEPARTEMENTS_PAIE },
  { id: 'prenom', libelle: 'Prénom', type: 'text' },
  { id: 'nom', libelle: 'Nom', type: 'text' },
  { id: 'fonction', libelle: 'Fonction', type: 'text' },
  { id: 'montant', libelle: 'Montant (F)', type: 'number' },
  { id: 'statut', libelle: 'Statut', type: 'select', options: STATUTS_PAIE },
  { id: 'date', libelle: 'Date', type: 'date' },
];
export const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

let FICHES_PAIE = [
  {
    id: 'paie-2026-08',
    mois: 'Août',
    moisIdx: 7,
    annee: 2026,
    statut: 'Clôturée',
    cachet: null,
    lignes: [
      { numero: 'PAY-2026-08-001', departement: 'Développement', prenom: 'Moussa', nom: 'Koné', fonction: 'Dev Fullstack', montant: 450000, statut: 'Payé', date: '31/08/2026' },
      { numero: 'PAY-2026-08-002', departement: 'Communication', prenom: 'Awa', nom: 'Diallo', fonction: 'Designer', montant: 350000, statut: 'Payé', date: '31/08/2026' },
    ],
  },
  {
    id: 'paie-2026-09',
    mois: 'Septembre',
    moisIdx: 8,
    annee: 2026,
    statut: 'Brouillon',
    cachet: null,
    lignes: [
      { numero: 'PAY-2026-09-001', departement: 'Développement', prenom: 'Moussa', nom: 'Koné', fonction: 'Dev Fullstack', montant: 450000, statut: 'Payé', date: '05/09/2026' },
      { numero: 'PAY-2026-09-002', departement: 'Développement', prenom: 'Sékou', nom: 'Traoré', fonction: 'Dev Frontend', montant: 400000, statut: 'Payé', date: '05/09/2026' },
      { numero: 'PAY-2026-09-003', departement: 'Communication', prenom: 'Awa', nom: 'Diallo', fonction: 'Designer', montant: 350000, statut: 'En attente', date: '—' },
    ],
  },
];

export const getFichesPaie = () => FICHES_PAIE;
export const getFichePaie = (id) => FICHES_PAIE.find((f) => f.id === id);

export function creerFichePaie(moisIdx, annee) {
  const mm = String(moisIdx + 1).padStart(2, '0');
  const id = `paie-${annee}-${mm}`;
  const existante = FICHES_PAIE.find((f) => f.id === id);
  if (existante) return { fiche: existante, creee: false };
  const fiche = { id, mois: MOIS[moisIdx], moisIdx, annee, statut: 'Brouillon', cachet: null, lignes: [] };
  FICHES_PAIE = [fiche, ...FICHES_PAIE].sort((a, b) => b.id.localeCompare(a.id));
  return { fiche, creee: true };
}

export function ajouterLignePaie(ficheId, valeurs) {
  const fiche = FICHES_PAIE.find((f) => f.id === ficheId);
  if (!fiche) return null;
  const mm = String(fiche.moisIdx + 1).padStart(2, '0');
  const ligne = {
    numero: `PAY-${fiche.annee}-${mm}-${String(fiche.lignes.length + 1).padStart(3, '0')}`,
    departement: valeurs.departement,
    prenom: valeurs.prenom.trim(),
    nom: valeurs.nom.trim(),
    fonction: valeurs.fonction.trim(),
    montant: Number(valeurs.montant),
    statut: valeurs.statut,
    date: valeurs.date,
  };
  fiche.lignes = [...fiche.lignes, ligne];
  return ligne;
}

export function majLignePaie(ficheId, numero, patch) {
  const fiche = FICHES_PAIE.find((f) => f.id === ficheId);
  if (!fiche) return;
  fiche.lignes = fiche.lignes.map((l) => (l.numero === numero ? { ...l, ...patch } : l));
}

export function cloturerFichePaie(ficheId) {
  FICHES_PAIE = FICHES_PAIE.map((f) => (f.id === ficheId ? { ...f, statut: 'Clôturée' } : f));
}

/* Cachet du directeur financier — image uploadée, exigée avant clôture.
   Maquette : POST /api/v1/finance/paie/:id/cachet/ prendra le relais. */
export function definirCachetFiche(ficheId, cachet) {
  FICHES_PAIE = FICHES_PAIE.map((f) => (f.id === ficheId ? { ...f, cachet } : f));
}
