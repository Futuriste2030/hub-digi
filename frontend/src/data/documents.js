/* Store mock Documents rédactionnels — endpoints DRF à venir :
   GET/POST /api/v1/documents/?categorie=contrat|courrier|communique|litige
   V2 : génération PDF serveur (WeasyPrint) + archivage auto. */

let DOCUMENTS = [
  {
    id: 'doc-1',
    categorie: 'contrats',
    titre: 'Contrat cadre Orange Mali 2026',
    destinataire: 'Orange Mali',
    date: '12/01/2026',
    statut: 'Signé',
    contenu: '<h2>Article 1 — Objet</h2><p>Digi Com & Technologies réalise pour Orange Mali la conception, le développement et la maintenance de ses plateformes digitales.</p><h2>Article 2 — Durée</h2><p>Le présent contrat est conclu pour une durée de douze mois à compter de sa signature.</p>',
  },
  {
    id: 'doc-2',
    categorie: 'courriers',
    titre: 'Courrier N°042 — Relance Azalai',
    destinataire: 'Azalai Hotels',
    date: '05/09/2026',
    statut: 'Envoyé',
    contenu: '<p>Madame la Responsable,</p><p>Sauf erreur de notre part, la facture FACT-2026-0033 reste impayée à ce jour. Nous vous remercions de bien vouloir régulariser sous huitaine.</p><p>Cordialement,</p>',
  },
  {
    id: 'doc-3',
    categorie: 'communiques',
    titre: 'Communiqué — Lancement Djama Pay',
    destinataire: 'Presse',
    date: '08/09/2026',
    statut: 'Publié',
    contenu: '<h2>Digi Com livre l application Djama Pay</h2><p>Bamako, le 8 septembre 2026 — Digi Com & Technologies annonce la mise en ligne de l application mobile Djama Pay, développée pour la fintech Djama.</p>',
  },
  {
    id: 'doc-4',
    categorie: 'litiges',
    titre: 'Rapport — Retard Azalai e-commerce',
    destinataire: 'Interne',
    date: '02/09/2026',
    statut: 'En cours',
    contenu: '<h2>Faits</h2><p>Le jalon cadrage accuse trois semaines de retard, faute de validation client des maquettes.</p><h2>Position</h2><p>Proposer un avenant de délai sans pénalités, contre acompte de 30 %.</p>',
  },
];

export const STATUTS_DOC = ['Brouillon', 'Ouvert', 'En cours', 'À valider', 'À signer', 'Envoyé', 'Publié', 'Signé', 'Résolu', 'Classé', 'Archivé'];
export const TONS_DOC = {
  Brouillon: 'neutre',
  Ouvert: 'info',
  'En cours': 'alerte',
  'À valider': 'alerte',
  'À signer': 'alerte',
  Envoyé: 'info',
  Publié: 'succes',
  Signé: 'succes',
  Résolu: 'succes',
  Classé: 'neutre',
  Archivé: 'neutre',
};

/* Flux de statuts par catégorie — SPEC §5.2/§5.6 : chaque transition est
   tracée (AuditLog backend) et notifiée. Seules les transitions listées
   sont proposées dans l'interface. */
export const TRANSITIONS_DOC = {
  contrats: {
    Brouillon: ['À signer'],
    'À signer': ['Signé'],
    Signé: ['Archivé'],
    Archivé: [],
  },
  litiges: {
    Ouvert: ['En cours', 'Classé'],
    'En cours': ['Résolu', 'Classé'],
    Résolu: ['Archivé'],
    Classé: ['Archivé'],
    Archivé: [],
  },
  courriers: {
    Brouillon: ['Envoyé'],
    Envoyé: ['Archivé'],
    Archivé: [],
  },
  communiques: {
    Brouillon: ['À valider'],
    'À valider': ['Publié'],
    Publié: ['Archivé'],
    Archivé: [],
  },
};

const STATUT_INITIAL = { contrats: 'Brouillon', litiges: 'Ouvert', courriers: 'Brouillon', communiques: 'Brouillon' };

export const MODELES = {
  contrats: [
    { id: 'prestation', libelle: 'Prestation de service', html: '<h2>Article 1 — Objet</h2><p>Le prestataire réalise pour le client la mission décrite en annexe.</p><h2>Article 2 — Prix</h2><p>Le montant forfaitaire est payable à 30 jours date de facture.</p><h2>Article 3 — Durée</h2><p>Le contrat prend effet à sa signature pour douze mois.</p>' },
    { id: 'nda', libelle: 'Accord de confidentialité', html: '<h2>Article 1 — Informations confidentielles</h2><p>Les parties s engagent à ne divulguer aucune information échangée dans le cadre des discussions.</p><h2>Article 2 — Durée</h2><p>L obligation court pendant trois ans après signature.</p>' },
  ],
  courriers: [
    { id: 'officiel', libelle: 'Courrier officiel', html: '<p>Madame, Monsieur,</p><p>Par la présente, nous vous informons que…</p><p>Dans l attente de votre retour, cordialement,</p>' },
    { id: 'relance', libelle: 'Relance facture', html: '<p>Madame, Monsieur,</p><p>Sauf erreur de notre part, votre facture reste impayée à ce jour. Merci de régulariser sous huitaine.</p><p>Cordialement,</p>' },
  ],
  communiques: [
    { id: 'presse', libelle: 'Communiqué de presse', html: '<h2>Titre de l annonce</h2><p>Bamako, le… — Digi Com & Technologies annonce…</p><p>Contact presse : contact@digicom.ml</p>' },
  ],
  litiges: [
    { id: 'rapport', libelle: 'Rapport de litige', html: '<h2>Faits</h2><p>Décrire les faits de façon datée et neutre.</p><h2>Position</h2><p>Position juridique et issue proposée.</p>' },
  ],
};

export const getDocuments = (categorie) => DOCUMENTS.filter((d) => d.categorie === categorie);

export function ajouterDocument({ categorie, titre, destinataire, contenu }) {
  const d = {
    id: `doc-${Date.now()}`,
    categorie,
    titre: titre.trim(),
    destinataire: destinataire.trim() || '—',
    date: new Date().toLocaleDateString('fr-FR'),
    statut: STATUT_INITIAL[categorie] || 'Brouillon',
    contenu,
  };
  DOCUMENTS = [d, ...DOCUMENTS];
  return d;
}

export function majDocument(id, patch) {
  DOCUMENTS = DOCUMENTS.map((d) => (d.id === id ? { ...d, ...patch } : d));
}

/* Changement de statut contrôlé : refuse les transitions hors flux.
   Retourne le document maj ou null si transition interdite. */
export function changerStatutDocument(id, statut) {
  const doc = DOCUMENTS.find((d) => d.id === id);
  if (!doc) return null;
  const autorises = TRANSITIONS_DOC[doc.categorie]?.[doc.statut] ?? [];
  if (!autorises.includes(statut)) return null;
  DOCUMENTS = DOCUMENTS.map((d) => (d.id === id ? { ...d, statut } : d));
  return DOCUMENTS.find((d) => d.id === id);
}
