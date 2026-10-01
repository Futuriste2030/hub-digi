/* Données de maquette — structure prête pour GET /api/v1/clients/ et /clients/:id/overview/ */

export const CLIENTS = [
  {
    id: 'orange-mali',
    societe: 'Orange Mali',
    contact: 'Awa Diallo',
    fonction: 'Directrice Marketing',
    email: 'contact@orangemali.ml',
    phone: '+223 20 11 22 33',
    adresse: 'ACI 2000, Bamako, Mali',
    statut: 'Actif',
    tonStatut: 'succes',
    tags: ['Télécom', 'Grand compte'],
    kpi: { projetsActifs: 2, impayes: '0 F', ticketsOuverts: 1 },
    projets: [
      { nom: 'Site vitrine', type: 'Site web', statut: 'En cours', ton: 'info', avancement: 80, deadline: '24/09/2026', bugs: 1 },
      { nom: 'App My Orange', type: 'App mobile', statut: 'En cours', ton: 'info', avancement: 45, deadline: '10/10/2026', bugs: 3 },
    ],
    campagnes: [
      { nom: 'Rentrée Fibre', canal: 'Meta + Affichage', statut: 'En cours', ton: 'info', budget: '3 200 000 F' },
      { nom: 'Ramadan', canal: 'TV + Radio', statut: 'Terminée', ton: 'succes', budget: '5 000 000 F' },
    ],
    calendrier: [
      { date: '12/09/2026', canal: 'Facebook', titre: 'Offre fibre -40%', statut: 'Programmé' },
      { date: '15/09/2026', canal: 'LinkedIn', titre: 'Bilan RSE T2', statut: 'À valider' },
    ],
    factures: [
      { numero: 'FACT-2026-0041', objet: 'Site vitrine — jalon 2', montant: '850 000 F', statut: 'Envoyée', ton: 'info', date: '02/09/2026' },
      { numero: 'FACT-2026-0040', objet: 'Site vitrine — jalon 1', montant: '2 400 000 F', statut: 'Payée', ton: 'succes', date: '10/08/2026' },
    ],
    recus: [{ numero: 'RECU-2026-0031', facture: 'FACT-2026-0040', montant: '2 400 000 F', date: '18/08/2026' }],
    solde: '850 000 F à recevoir',
    contrats: [{ titre: 'Contrat cadre 2026', type: 'Prestation annuelle', fin: '30/09/2026', statut: 'À renouveler', ton: 'alerte' }],
    tickets: [{ ref: 'TICK-2026-0338', objet: 'Texte page tarifs', statut: 'Qualifié', ton: 'alerte', delai: '09:47' }],
    mails: [
      { objet: 'Votre facture FACT-2026-0041 est disponible', date: '02/09/2026', statut: 'Envoyé' },
      { objet: 'Visuels campagne à valider', date: '28/08/2026', statut: 'Envoyé' },
    ],
    documents: [
      { nom: 'Contrat cadre 2026.pdf', meta: 'PDF · 1,2 Mo · 12/01/2026' },
      { nom: 'Logo CMJN.zip', meta: 'ZIP · 8,4 Mo · 03/02/2026' },
      { nom: 'Cahier des charges site.pdf', meta: 'PDF · 3,1 Mo · 20/03/2026' },
    ],
  },
  {
    id: 'moov-africa',
    societe: 'Moov Africa',
    contact: 'Ibrahim Touré',
    fonction: 'Chef de projet digital',
    email: 'i.toure@moov-africa.ml',
    phone: '+223 20 44 55 66',
    adresse: 'Hamdallaye, Bamako, Mali',
    statut: 'Actif',
    tonStatut: 'succes',
    tags: ['Télécom'],
    kpi: { projetsActifs: 1, impayes: '450 000 F', ticketsOuverts: 1 },
    projets: [
      { nom: 'Campagne rentrée', type: 'Communication', statut: 'En review', ton: 'alerte', avancement: 95, deadline: '15/09/2026', bugs: 0 },
    ],
    campagnes: [
      { nom: 'Campagne rentrée', canal: 'TikTok + Affichage', statut: 'En review', ton: 'alerte', budget: '2 800 000 F' },
    ],
    calendrier: [{ date: '13/09/2026', canal: 'TikTok', titre: 'Teasing rentrée', statut: 'Programmé' }],
    factures: [
      { numero: 'FACT-2026-0039', objet: 'Campagne rentrée — acompte', montant: '450 000 F', statut: 'Impayée', ton: 'erreur', date: '20/08/2026' },
    ],
    recus: [],
    solde: '450 000 F à recevoir',
    contrats: [{ titre: 'Contrat campagne rentrée', type: 'Campagne', fin: '30/09/2026', statut: 'En cours', ton: 'info' }],
    tickets: [{ ref: 'TICK-2026-0339', objet: 'Visuel à valider', statut: 'En attente aval', ton: 'alerte', delai: 'Il y a 38 min' }],
    mails: [{ objet: 'Relance : facture FACT-2026-0039 en attente', date: '05/09/2026', statut: 'Envoyé' }],
    documents: [{ nom: 'Brief campagne.pdf', meta: 'PDF · 0,9 Mo · 01/08/2026' }],
  },
  {
    id: 'djama',
    societe: 'Djama',
    contact: 'Mariam Koné',
    fonction: 'CEO',
    email: 'contact@djama.ml',
    phone: '+223 70 11 22 33',
    adresse: 'Badalabougou, Bamako, Mali',
    statut: 'Actif',
    tonStatut: 'succes',
    tags: ['Startup', 'Fintech'],
    kpi: { projetsActifs: 1, impayes: '750 000 F', ticketsOuverts: 2 },
    projets: [
      { nom: 'App mobile Djama Pay', type: 'App mobile', statut: 'En cours', ton: 'info', avancement: 45, deadline: '10/10/2026', bugs: 4 },
    ],
    campagnes: [],
    calendrier: [],
    factures: [
      { numero: 'FACT-2026-0036', objet: 'App Djama Pay — sprint 3', montant: '750 000 F', statut: 'Impayée', ton: 'erreur', date: '15/08/2026' },
    ],
    recus: [],
    solde: '750 000 F à recevoir',
    contrats: [{ titre: 'Contrat de développement', type: 'Régie', fin: '31/12/2026', statut: 'En cours', ton: 'info' }],
    tickets: [
      { ref: 'TICK-2026-0341', objet: 'Erreur 500 page paiement', statut: 'Nouveau', ton: 'info', delai: 'Il y a 12 min' },
      { ref: 'TICK-2026-0331', objet: 'Accès espace client', statut: 'Répondu', ton: 'succes', delai: 'Hier' },
    ],
    mails: [{ objet: 'Suivi de votre ticket TICK-2026-0341', date: '10/09/2026', statut: 'Envoyé' }],
    documents: [{ nom: 'Spécifications API.pdf', meta: 'PDF · 2,2 Mo · 10/07/2026' }],
  },
  {
    id: 'azalai',
    societe: 'Azalai Hotels',
    contact: 'Fatoumata Sy',
    fonction: 'Responsable communication',
    email: 'f.sy@azalaihotels.com',
    phone: '+223 20 77 88 99',
    adresse: 'Quartier du Fleuve, Bamako, Mali',
    statut: 'En pause',
    tonStatut: 'alerte',
    tags: ['Hôtellerie'],
    kpi: { projetsActifs: 1, impayes: '50 000 F', ticketsOuverts: 1 },
    projets: [
      { nom: 'Refonte e-commerce', type: 'Site web', statut: 'À risque', ton: 'erreur', avancement: 20, deadline: '30/11/2026', bugs: 2 },
    ],
    campagnes: [],
    calendrier: [],
    factures: [
      { numero: 'FACT-2026-0033', objet: 'Refonte — cadrage', montant: '50 000 F', statut: 'Envoyée', ton: 'info', date: '28/08/2026' },
    ],
    recus: [],
    solde: '50 000 F à recevoir',
    contrats: [{ titre: 'Contrat refonte site', type: 'Forfait', fin: '30/11/2026', statut: 'En cours', ton: 'info' }],
    tickets: [{ ref: 'TICK-2026-0335', objet: 'Facture illisible', statut: 'Répondu', ton: 'succes', delai: 'Hier' }],
    mails: [],
    documents: [],
  },
  {
    id: 'sonatel',
    societe: 'Sonatel',
    contact: 'Cheikh Ndiaye',
    fonction: 'Directeur digital',
    email: 'c.ndiaye@sonatel.sn',
    phone: '+221 33 000 11 22',
    adresse: 'Dakar, Sénégal',
    statut: 'Prospect',
    tonStatut: 'info',
    tags: ['Télécom', 'Prospect'],
    kpi: { projetsActifs: 0, impayes: '0 F', ticketsOuverts: 0 },
    projets: [],
    campagnes: [],
    calendrier: [],
    factures: [],
    recus: [],
    solde: 'Aucune facture',
    contrats: [],
    tickets: [],
    mails: [{ objet: 'Proposition commerciale — refonte site', date: '01/09/2026', statut: 'Envoyé' }],
    documents: [{ nom: 'Proposition commerciale.pdf', meta: 'PDF · 1,5 Mo · 01/09/2026' }],
  },
];

/* Création mock — POST /api/v1/clients/ prendra le relais. */
const TONS_STATUT = { Prospect: 'info', Actif: 'succes', 'En pause': 'alerte' };

/* Identifiants espace client — le système génère username + mot de passe
   transmis au client. Backend : hash bcrypt + envoi mail, jamais en clair en base. */
export function genererUsername(societe) {
  const base = slugifier(societe) || 'client';
  return `${base}-${Math.floor(10 + Math.random() * 90)}`;
}

export function genererMdp(longueur = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let mdp = '';
  const tirage = new Uint32Array(longueur);
  crypto.getRandomValues(tirage);
  for (let i = 0; i < longueur; i++) mdp += alphabet[tirage[i] % alphabet.length];
  return mdp;
}

export function slugifier(texte) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* Identifiants initiaux des clients existants (mock seed). */
CLIENTS.forEach((c) => {
  if (!c.acces) c.acces = { username: `${c.id}-${Math.floor(10 + Math.random() * 90)}`, mdp: genererMdp() };
});

export const getClient = (id) => CLIENTS.find((c) => c.id === id);

/* Enrichissement portail client (mock seed) : corps des mails, assets à valider
   (image = pièce jointe visualisable, vidéo = lien externe), détails projets
   (jalons, livrables, bugs). Backend : endpoints portal_client dédiés. */
const CORPS_MAILS = {
  'Votre facture FACT-2026-0041 est disponible': 'Bonjour,\n\nVotre facture FACT-2026-0041 (850 000 F) est disponible dans votre espace client, onglet Factures & reçus.\n\nCordialement,\nLa Finance — Digi Com & Technologies',
  'Visuels campagne à valider': 'Bonjour,\n\nTrois visuels de la campagne vous attendent dans votre espace client, onglet Mes projets. Merci de les valider ou commenter.\n\nCordialement,\nL équipe Com — Digi Com & Technologies',
  'Relance : facture FACT-2026-0039 en attente': 'Bonjour,\n\nSauf erreur de notre part, la facture FACT-2026-0039 (450 000 F) reste impayée. Vous pouvez la régler depuis votre espace client.\n\nCordialement,\nLa Finance — Digi Com & Technologies',
  'Suivi de votre ticket TICK-2026-0341': 'Bonjour,\n\nVotre ticket TICK-2026-0341 (Erreur 500 page paiement) est pris en charge par nos équipes. Suivi dans l onglet Mes tickets.\n\nCordialement,\nLe Secrétariat — Digi Com & Technologies',
  'Proposition commerciale — refonte site': 'Bonjour,\n\nVeuillez trouver notre proposition commerciale pour la refonte de votre site vitrine. Votre espace client sera activé à la signature.\n\nCordialement,\nDigi Com & Technologies',
};

CLIENTS.forEach((c) => {
  c.mails = (c.mails ?? []).map((m, i) => ({
    ...m,
    id: m.id ?? `mail-${c.id}-${i}`,
    direction: m.direction ?? 'recu',
    lu: m.lu ?? false,
    corps: m.corps ?? CORPS_MAILS[m.objet] ?? 'Bonjour,\n\nVeuillez trouver ci-joint les détails dans votre espace client.\n\nCordialement,\nDigi Com & Technologies',
  }));
  c.campagnes = (c.campagnes ?? []).map((camp, ci) => {
    if (camp.assets) return camp;
    const aValider = ['En cours', 'En review'].includes(camp.statut);
    return {
      ...camp,
      assets: [
        { id: `as-${c.id}-${ci}-1`, type: 'image', nom: `${camp.nom} — visuel 1`, statut: aValider ? 'À valider' : 'Validé' },
        { id: `as-${c.id}-${ci}-2`, type: 'image', nom: `${camp.nom} — visuel 2`, statut: aValider ? 'À valider' : 'Validé' },
        { id: `as-${c.id}-${ci}-3`, type: 'video', nom: `${camp.nom} — teaser`, url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', statut: aValider ? 'À valider' : 'Validé' },
      ],
    };
  });
  c.projets = (c.projets ?? []).map((p, pi) => {
    if (p.jalons) return p;
    const nbBugs = p.bugs ?? 0;
    return {
      ...p,
      description: `${p.nom} — ${p.type} réalisé par Digi Com & Technologies pour ${c.societe}. Suivi d avancement en temps réel dans cet espace.`,
      jalons: [
        { titre: 'Cadrage & maquettes', statut: 'Terminé' },
        { titre: 'Développement', statut: p.avancement >= 50 ? 'Terminé' : 'En cours' },
        { titre: 'Recette & mise en ligne', statut: p.avancement >= 95 ? 'En cours' : 'À venir' },
      ],
      livrables: p.avancement >= 50
        ? [{ nom: `${p.nom} — dossier de cadrage.pdf`, taille: '2,1 Mo' }]
        : [],
      bugsDetail: Array.from({ length: nbBugs }, (_, i) => ({
        ref: `BUG-2026-${String(80 + pi * 5 + i).padStart(4, '0')}`,
        titre: `Anomalie ${i + 1} — ${p.nom}`,
        statut: i === 0 ? 'En cours' : 'Nouveau',
      })),
    };
  });
});

/* Réponse mail depuis le portail client. Backend : POST /espace/mails/:id/reply/ */
export function ajouterReponseMailClient(clientId, { objet, corps }) {
  const c = CLIENTS.find((x) => x.id === clientId);
  if (!c) return null;
  const m = {
    id: `mail-${Date.now()}`,
    objet: objet.startsWith('Re :') ? objet : `Re : ${objet}`,
    corps,
    date: new Date().toLocaleDateString('fr-FR'),
    statut: 'Envoyé',
    direction: 'envoye',
    lu: true,
  };
  c.mails = [m, ...c.mails];
  return m;
}

export function marquerMailLu(clientId, mailId) {
  const c = CLIENTS.find((x) => x.id === clientId);
  if (c) c.mails = c.mails.map((m) => (m.id === mailId ? { ...m, lu: true } : m));
}

/* Validation d'un visuel/vidéo par le client. Backend : POST /espace/visuels/:id/valider/ */
export function validerAssetClient(clientId, campagneNom, assetId) {
  const c = CLIENTS.find((x) => x.id === clientId);
  if (!c) return;
  c.campagnes = c.campagnes.map((camp) => (camp.nom === campagneNom
    ? { ...camp, assets: camp.assets.map((a) => (a.id === assetId ? { ...a, statut: 'Validé' } : a)) }
    : camp));
}

/* Reset mot de passe — backend : POST /api/v1/clients/:id/reset-password/
   (nouveau mdp hashé + retransmis au client par mail). */
export function resetMdpClient(id) {
  const mdp = genererMdp();
  const c = CLIENTS.find((x) => x.id === id);
  if (c) c.acces = { ...(c.acces ?? { username: genererUsername(c.societe) }), mdp };
  return mdp;
}

export function ajouterClient({ societe, contact, fonction, email, phone, adresse, statut, acces }) {
  let id = slugifier(societe);
  if (CLIENTS.some((c) => c.id === id)) id = `${id}-${Date.now() % 1000}`;
  const client = {
    id,
    societe: societe.trim(),
    contact: contact.trim(),
    fonction: fonction.trim() || '—',
    email: email.trim(),
    phone: phone.trim() || '—',
    adresse: adresse.trim() || '—',
    statut,
    tonStatut: TONS_STATUT[statut] || 'info',
    tags: [statut],
    acces: acces ?? { username: genererUsername(societe), mdp: genererMdp() },
    kpi: { projetsActifs: 0, impayes: '0 F', ticketsOuverts: 0 },
    projets: [],
    campagnes: [],
    calendrier: [],
    factures: [],
    recus: [],
    solde: 'Aucune facture',
    contrats: [],
    tickets: [],
    mails: [],
    documents: [],
  };
  CLIENTS.unshift(client);
  return client;
}
