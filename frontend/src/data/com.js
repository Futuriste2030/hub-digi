/* Store mock Communication — endpoints DRF à venir :
   GET /api/v1/com/calendar/ /campaigns/ /medias/ */

export const STATUTS_PUB = ['Brouillon', 'À valider', 'Programmé', 'Publié'];
export const TONS_PUB = { Brouillon: 'neutre', 'À valider': 'alerte', Programmé: 'info', Publié: 'succes' };

export const CANAUX = ['Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'Meta', 'TV', 'Radio', 'Affichage'];

/* Espace propre de l'agence : ses propres publications, campagnes et médias. */
export const AGENCE = 'Digi Com';
export const ESPACES = ['Tous', 'Clients', 'Digi Com'];
export const estAgence = (client) => client === AGENCE;

/* Pièce jointe de publication : {nom, type: Image|Vidéo|Document, taille, url?}.
   Image/Document = fichier (mock : nom + taille), Vidéo = lien externe à ouvrir.
   Backend : upload réel + champ url (YouTube/Vimeo/Drive). */
let CALENDRIER = [
  { id: 'p1', date: '05/09/2026', canaux: ['Facebook'], titre: 'Jeu concours rentrée', client: 'Moov Africa', statut: 'Publié', piecesJointes: [{ nom: 'Visuel jeu concours.jpg', type: 'Image', taille: '2,4 Mo' }] },
  { id: 'p2', date: '08/09/2026', canaux: ['Instagram'], titre: 'Lancement Djama Pay v2', client: 'Djama', statut: 'Publié', piecesJointes: [{ nom: 'Teaser lancement.mp4', type: 'Vidéo', taille: '—', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' }] },
  { id: 'p3', date: '12/09/2026', canaux: ['Facebook'], titre: 'Offre fibre -40%', client: 'Orange Mali', statut: 'Programmé', piecesJointes: [{ nom: 'Visuel fibre -40%.jpg', type: 'Image', taille: '2,1 Mo' }] },
  { id: 'p4', date: '13/09/2026', canaux: ['TikTok'], titre: 'Teasing rentrée', client: 'Moov Africa', statut: 'Programmé', piecesJointes: [{ nom: 'Teasing rentrée.mp4', type: 'Vidéo', taille: '—', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' }] },
  { id: 'p5', date: '15/09/2026', canaux: ['LinkedIn'], titre: 'Bilan RSE T2', client: 'Orange Mali', statut: 'À valider', piecesJointes: [] },
  { id: 'p6', date: '16/09/2026', canaux: ['Instagram'], titre: 'Tutoriel paiement en 30s', client: 'Djama', statut: 'Brouillon', piecesJointes: [] },
  { id: 'p7', date: '18/09/2026', canaux: ['Facebook'], titre: 'Séjour weekend -20%', client: 'Azalai Hotels', statut: 'À valider', piecesJointes: [{ nom: 'Photos piscine.zip', type: 'Document', taille: '22 Mo' }] },
  { id: 'p8', date: '19/09/2026', canaux: ['Facebook', 'LinkedIn'], titre: 'Nous recrutons un stagiaire design', client: AGENCE, statut: 'À valider', piecesJointes: [] },
  { id: 'p9', date: '20/09/2026', canaux: ['LinkedIn'], titre: 'Cas client refonte', client: 'Sonatel', statut: 'Brouillon', piecesJointes: [] },
  { id: 'p10', date: '22/09/2026', canaux: ['LinkedIn', 'Facebook'], titre: 'Nos réalisations du trimestre', client: AGENCE, statut: 'Programmé', piecesJointes: [] },
];

let CAMPAGNES = [
  { id: 'c1', nom: 'Rentrée Fibre', client: 'Orange Mali', canaux: ['Meta', 'Affichage'], budget: '3 200 000 F', objectif: '500 leads qualifiés', statut: 'En cours', ton: 'info', stats: '120 k portée · 8,4 k interactions', progression: 65 },
  { id: 'c2', nom: 'Campagne rentrée', client: 'Moov Africa', canaux: ['TikTok', 'Affichage'], budget: '2 800 000 F', objectif: '1 M de vues', statut: 'En review', ton: 'alerte', stats: '820 k vues · 41 k likes', progression: 80 },
  { id: 'c3', nom: 'Lancement Djama Pay', client: 'Djama', canaux: ['Instagram', 'TikTok'], budget: '1 500 000 F', objectif: '10 k installations', statut: 'En cours', ton: 'info', stats: '6,2 k installs · 310 k portée', progression: 45 },
  { id: 'c4', nom: 'Ramadan', client: 'Orange Mali', canaux: ['TV', 'Radio'], budget: '5 000 000 F', objectif: 'Notoriété nationale', statut: 'Terminée', ton: 'succes', stats: '2,1 M contacts · +12 pts notoriété', progression: 100 },
  { id: 'c5', nom: 'Notoriété agence', client: AGENCE, canaux: ['LinkedIn', 'Facebook'], budget: '800 000 F', objectif: '2 000 abonnés', statut: 'En cours', ton: 'info', stats: '1 240 abonnés · 18 k portée', progression: 55 },
];

let MEDIAS = [
  { id: 'm1', nom: 'Logo CMJN Orange', client: 'Orange Mali', type: 'Image', taille: '8,4 Mo', date: '03/02/2026', statut: 'Validé', apercu: null },
  { id: 'm2', nom: 'Visuel fibre -40%', client: 'Orange Mali', type: 'Image', taille: '2,1 Mo', date: '09/09/2026', statut: 'À valider', apercu: null },
  { id: 'm3', nom: 'Teasing rentrée.mp4', client: 'Moov Africa', type: 'Vidéo', taille: '48 Mo', date: '07/09/2026', statut: 'À valider', apercu: null },
  { id: 'm4', nom: 'Charte graphique Djama', client: 'Djama', type: 'Document', taille: '5,6 Mo', date: '20/06/2026', statut: 'Validé', apercu: null },
  { id: 'm5', nom: 'Photos piscine Azalai', client: 'Azalai Hotels', type: 'Image', taille: '22 Mo', date: '15/08/2026', statut: 'Validé', apercu: null },
  { id: 'm6', nom: 'Jingle radio 30s', client: 'Moov Africa', type: 'Audio', taille: '1,4 Mo', date: '02/09/2026', statut: 'À valider', apercu: null },
  { id: 'm7', nom: 'Cover LinkedIn agence', client: AGENCE, type: 'Image', taille: '1,1 Mo', date: '06/09/2026', statut: 'À valider', apercu: null },
  { id: 'm8', nom: 'Showreel 2026', client: AGENCE, type: 'Vidéo', taille: '—', date: '01/09/2026', statut: 'Validé', apercu: null, source: 'lien', url: 'https://www.youtube.com/watch?v=digicom2026', plateforme: 'YouTube' },
];

export const TYPES_MEDIA = ['Image', 'Vidéo', 'Audio', 'Document'];
export const STATUTS_MEDIA = ['À valider', 'Validé', 'Rejeté'];
export const TONS_MEDIA = { 'À valider': 'alerte', Validé: 'succes', Rejeté: 'erreur' };

export const getCalendrier = () => CALENDRIER;
export const getCampagnes = () => CAMPAGNES;
export const getMedias = () => MEDIAS;

export const filtrerEspace = (items, espace) => {
  if (espace === 'Digi Com') return items.filter((i) => estAgence(i.client));
  if (espace === 'Clients') return items.filter((i) => !estAgence(i.client));
  return items;
};

export const texteCanaux = (canaux) => (Array.isArray(canaux) ? canaux.join(' · ') : canaux);

export function ajouterPublication({ date, canaux, titre, client, piecesJointes = [] }) {
  const [a, m, j] = date.split('-');
  const pub = { id: `p-${Date.now()}`, date: `${j}/${m}/${a}`, canaux, titre, client, statut: 'Brouillon', piecesJointes };
  const cle = (d) => `${d.slice(6, 10)}${d.slice(3, 5)}${d.slice(0, 2)}`;
  CALENDRIER = [...CALENDRIER, pub].sort((x, y) => cle(x.date).localeCompare(cle(y.date)));
  return pub;
}

export function avancerPublication(id) {
  CALENDRIER = CALENDRIER.map((p) => {
    if (p.id !== id) return p;
    const i = Math.min(STATUTS_PUB.length - 1, STATUTS_PUB.indexOf(p.statut) + 1);
    return { ...p, statut: STATUTS_PUB[i] };
  });
}

export function ajouterCampagne({ nom, client, canaux, budget, objectif }) {
  const c = {
    id: `c-${Date.now()}`,
    nom,
    client,
    canaux,
    budget: `${Number(budget).toLocaleString('fr-FR')} F`,
    objectif,
    statut: 'Brouillon',
    ton: 'neutre',
    stats: 'Démarrage — premiers indicateurs à venir',
    progression: 0,
  };
  CAMPAGNES = [c, ...CAMPAGNES];
  return c;
}

/* Saisie manuelle hebdo des stats (copiées depuis Business Suite / TikTok).
   V2 : connecter les API Meta et TikTok, gratuites sous quotas. */
export function majStatsCampagne(id, { stats, progression }) {
  CAMPAGNES = CAMPAGNES.map((c) =>
    c.id === id ? { ...c, stats, progression: Math.max(0, Math.min(100, Number(progression) || 0)) } : c,
  );
}

/* source 'fichier' = stocké (VPS puis objet), 'lien' = 0 octet (YouTube, Vimeo, Drive).
   Règle : vidéo = lien par défaut, jamais de MP4 lourd sur le VPS. */
export function ajouterMedia({ nom, client, type, taille, apercu, source, url, plateforme }) {
  const m = {
    id: `m-${Date.now()}`,
    nom,
    client,
    type,
    taille,
    date: new Date().toLocaleDateString('fr-FR'),
    statut: 'À valider',
    apercu,
    source: source || 'fichier',
    url: url || null,
    plateforme: plateforme || null,
  };
  MEDIAS = [m, ...MEDIAS];
  return m;
}

export function validerMedia(id, statut) {
  MEDIAS = MEDIAS.map((m) => (m.id === id ? { ...m, statut } : m));
}
