/* Store mock RH — endpoints DRF à venir :
   /rh/employees/ /leaves/ /recruitments/ + validation Administration. */

export const DEPARTEMENTS_RH = ['Administration', 'Communication', 'Développement', 'RH', 'Juridique', 'Finance'];
export const TYPES_CONTRAT = ['CDI', 'CDD', 'Stage', 'Consultant'];

let EMPLOYES = [
  { id: 'moussa-kone', prenom: 'Moussa', nom: 'Koné', fonction: 'Dev Fullstack', departement: 'Développement', email: 'm.kone@digicom.ml', phone: '+223 70 11 22 33', contrat: 'CDI', salaire: 450000, embauche: '15/01/2024', statut: 'Actif', soldeConges: 18, contratHTML: null },
  { id: 'sekou-traore', prenom: 'Sékou', nom: 'Traoré', fonction: 'Dev Frontend', departement: 'Développement', email: 's.traore@digicom.ml', phone: '+223 70 44 55 66', contrat: 'CDI', salaire: 400000, embauche: '01/03/2024', statut: 'Actif', soldeConges: 20, contratHTML: null },
  { id: 'awa-diallo', prenom: 'Awa', nom: 'Diallo', fonction: 'Designer', departement: 'Communication', email: 'a.diallo@digicom.ml', phone: '+223 70 77 88 99', contrat: 'CDI', salaire: 350000, embauche: '10/06/2024', statut: 'Actif', soldeConges: 15, contratHTML: null },
  { id: 'fatoumata-diarra', prenom: 'Fatoumata', nom: 'Diarra', fonction: 'Comptable', departement: 'Finance', email: 'f.diarra@digicom.ml', phone: '+223 70 00 11 22', contrat: 'CDI', salaire: 400000, embauche: '05/02/2024', statut: 'Actif', soldeConges: 12, contratHTML: null },
  { id: 'mariam-cisse', prenom: 'Mariam', nom: 'Cissé', fonction: 'Juriste', departement: 'Juridique', email: 'm.cisse@digicom.ml', phone: '+223 70 33 44 55', contrat: 'CDD', salaire: 375000, embauche: '01/07/2026', statut: 'Actif', soldeConges: 8, contratHTML: null },
  { id: 'modibo-sangare', prenom: 'Modibo', nom: 'Sangaré', fonction: 'Logisticien', departement: 'Administration', email: 'm.sangare@digicom.ml', phone: '+223 70 66 77 88', contrat: 'CDI', salaire: 250000, embauche: '12/09/2023', statut: 'En congé', soldeConges: 5, contratHTML: null },
];

let CONGES = [
  { id: 'cg1', employeId: 'awa-diallo', du: '22/09/2026', au: '26/09/2026', jours: 5, motif: 'Congés annuels', statut: 'En attente' },
  { id: 'cg2', employeId: 'sekou-traore', du: '06/10/2026', au: '10/10/2026', jours: 5, motif: 'Mariage', statut: 'Validé' },
  { id: 'cg3', employeId: 'modibo-sangare', du: '08/09/2026', au: '12/09/2026', jours: 5, motif: 'Congés annuels', statut: 'Validé' },
  { id: 'cg4', employeId: 'moussa-kone', du: '15/09/2026', au: '15/09/2026', jours: 1, motif: 'Rendez-vous médical', statut: 'Refusé' },
];

let OFFRES = [
  {
    id: 'off1',
    titre: 'Dev Backend Django',
    departement: 'Développement',
    type: 'CDI',
    statut: 'Ouverte',
    candidats: [
      { id: 'cd1', nom: 'Ousmane Bah', email: 'o.bah@mail.ml', statut: 'Entretien', source: 'site' },
      { id: 'cd2', nom: 'Kadidiatou Sow', email: 'k.sow@mail.ml', statut: 'Reçue', source: 'site' },
      { id: 'cd3', nom: 'Youssouf Maïga', email: 'y.maiga@mail.ml', statut: 'Reçue', source: 'site' },
    ],
  },
  {
    id: 'off2',
    titre: 'Stagiaire design',
    departement: 'Communication',
    type: 'Stage',
    statut: 'Ouverte',
    candidats: [
      { id: 'cd4', nom: 'Nana Traoré', email: 'n.traore@mail.ml', statut: 'Retenue', source: 'site' },
      { id: 'cd5', nom: 'Boubacar Dembélé', email: 'b.dembele@mail.ml', statut: 'Rejetée', source: 'site' },
    ],
  },
];

export const STATUTS_CONGE = ['En attente', 'Validé', 'Refusé'];
export const TONS_CONGE = { 'En attente': 'alerte', Validé: 'succes', Refusé: 'erreur' };
export const STATUTS_CANDIDAT = ['Reçue', 'Entretien', 'Retenue', 'Rejetée'];
export const TONS_CANDIDAT = { Reçue: 'info', Entretien: 'alerte', Retenue: 'succes', Rejetée: 'erreur' };

export const getEmployes = () => EMPLOYES;
export const getEmploye = (id) => EMPLOYES.find((e) => e.id === id);
export const getConges = () => CONGES;
export const getOffres = () => OFFRES;

export function ajouterEmploye({ prenom, nom, fonction, departement, email, contrat, salaire }) {
  const e = {
    id: `${prenom.toLowerCase()}-${nom.toLowerCase()}-${Date.now() % 1000}`,
    prenom: prenom.trim(),
    nom: nom.trim(),
    fonction: fonction.trim(),
    departement,
    email: email.trim(),
    phone: '—',
    contrat,
    salaire: Number(salaire),
    embauche: new Date().toLocaleDateString('fr-FR'),
    statut: 'Actif',
    soldeConges: 30,
    contratHTML: null,
  };
  EMPLOYES = [e, ...EMPLOYES];
  return e;
}

export function majEmploye(id, patch) {
  EMPLOYES = EMPLOYES.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

export function ajouterConge({ employeId, du, au, motif }) {
  const debut = new Date(`${du}T00:00`);
  const fin = new Date(`${au}T00:00`);
  const jours = Math.max(1, Math.round((fin - debut) / 86400000) + 1);
  const f = (iso) => {
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
  };
  const c = { id: `cg-${Date.now()}`, employeId, du: f(du), au: f(au), jours, motif: motif.trim() || 'Congés annuels', statut: 'En attente' };
  CONGES = [c, ...CONGES];
  return c;
}

export function statuerConge(id, statut) {
  const conge = CONGES.find((c) => c.id === id);
  if (!conge) return;
  CONGES = CONGES.map((c) => (c.id === id ? { ...c, statut } : c));
  if (statut === 'Validé' && conge.statut === 'En attente') {
    EMPLOYES = EMPLOYES.map((e) =>
      e.id === conge.employeId ? { ...e, soldeConges: Math.max(0, e.soldeConges - conge.jours) } : e,
    );
  }
}

/* Les offres sont créées côté site vitrine — le HUB les reçoit via webhook,
   pas de création locale (voir WEBHOOK-CARRIERE.md). */

export function statuerCandidat(offreId, candidatId, statut) {
  OFFRES = OFFRES.map((o) =>
    o.id === offreId
      ? { ...o, candidats: o.candidats.map((c) => (c.id === candidatId ? { ...c, statut } : c)) }
      : o,
  );
}

/* Modèle de contrat pré-rempli par fiche employé — éditable avant PDF. */
export function modeleContrat(e, entreprise) {
  const duree = e.contrat === 'CDI' ? 'indéterminée' : e.contrat === 'CDD' ? 'déterminée de douze mois' : 'déterminée';
  return `<h2>Contrat de travail à durée ${duree}</h2><p>Entre <strong>${entreprise.raison}</strong>, ${entreprise.adresse}, Tél ${entreprise.phone}, ci-après « l Employeur », et <strong>${e.prenom} ${e.nom}</strong>, ci-après « le Salarié », il est convenu ce qui suit.</p><h2>Article 1 — Fonctions</h2><p>Le Salarié est engagé(e) en qualité de <strong>${e.fonction}</strong> au sein du département <strong>${e.departement}</strong>, à compter du ${e.embauche}.</p><h2>Article 2 — Rémunération</h2><p>Le salaire mensuel brut est fixé à <strong>${Number(e.salaire).toLocaleString('fr-FR')} F CFA</strong>, payable à terme échu par virement ou Mobile Money.</p><h2>Article 3 — Durée du travail</h2><p>La durée hebdomadaire est de quarante heures, du lundi au vendredi.</p><h2>Article 4 — Congés payés</h2><p>Le Salarié bénéficie de trente jours calendaires de congés payés par an, selon validation de la direction.</p><p>Fait en deux exemplaires à Bamako, le ${new Date().toLocaleDateString('fr-FR')}.</p>`;
}
