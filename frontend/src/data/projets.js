/* Données de maquette — structure prête pour GET /api/v1/projects/ et /projects/:id/ */

export const STATUTS_TACHE = [
  { id: 'a_faire', libelle: 'À faire' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'review', libelle: 'Review' },
  { id: 'termine', libelle: 'Terminé' },
];

/* Suivi transmis au client (portail /espace) — écrit côté agence
   dans ProjetDetail, section « Suivi client ».
   Jalons = grandes étapes de validation convenues (pas les tâches Kanban internes).
   Livrables = fichiers finalisés remis au client (nom + taille).
   Backend : /projects/:id/suivi/ (GET public portail, PATCH chef/admin). */
export const STATUTS_JALON = ['À venir', 'En cours', 'Terminé'];

export const PROJETS = [
  {
    id: 'site-orange',
    nom: 'Site vitrine Orange Mali',
    client: 'Orange Mali',
    clientId: 'orange-mali',
    type: 'Site web',
    statut: 'En cours',
    ton: 'info',
    deadline: '24/09/2026',
    repo: 'github.com/digicom/orange-vitrine',
    prod: 'https://orangemali.ml',
    staging: 'https://staging.orangemali.ml',
    trackerKey: 'digi_pub_9f2k41xm',
    jalons: [
      { titre: 'Cadrage & maquettes', statut: 'Terminé' },
      { titre: 'Développement', statut: 'Terminé' },
      { titre: 'Recette & mise en ligne', statut: 'En cours' },
    ],
    livrables: [{ nom: 'Site vitrine Orange Mali — dossier de cadrage.pdf', taille: '2,1 Mo' }],
    taches: [
      { id: 't1', titre: 'Maquette page tarifs', statut: 'termine', assigne: 'S. Traoré', temps: '12 h', priorite: 'Normale', ton: 'info' },
      { id: 't2', titre: 'Intégration page tarifs', statut: 'en_cours', assigne: 'M. Koné', temps: '8 h', priorite: 'Haute', ton: 'alerte' },
      { id: 't3', titre: 'Formulaire de contact', statut: 'review', assigne: 'S. Traoré', temps: '6 h', priorite: 'Normale', ton: 'info' },
      { id: 't4', titre: 'Optimisation des images', statut: 'a_faire', assigne: 'A. Diallo', temps: '4 h', priorite: 'Basse', ton: 'neutre' },
      { id: 't5', titre: 'Tunnel de devis fibre', statut: 'a_faire', assigne: 'M. Koné', temps: '16 h', priorite: 'Haute', ton: 'alerte' },
    ],
    bugs: [
      { numero: 'BUG-2026-0079', titre: 'Formulaire illisible sur Safari', gravite: 'Majeure', ton: 'alerte', statut: 'Nouveau', source: 'Tracker auto' },
      { numero: 'BUG-2026-0081', titre: 'Menu mobile qui chevauche', gravite: 'Mineure', ton: 'info', statut: 'Confirmé', source: 'Manuel' },
    ],
  },
  {
    id: 'app-djama',
    nom: 'App mobile Djama Pay',
    client: 'Djama',
    clientId: 'djama',
    type: 'App mobile',
    statut: 'En cours',
    ton: 'info',
    deadline: '10/10/2026',
    repo: 'github.com/digicom/djama-pay',
    prod: 'TestFlight + Play interne',
    staging: 'staging.djama.ml',
    trackerKey: null,
    jalons: [
      { titre: 'Cadrage & maquettes', statut: 'Terminé' },
      { titre: 'Développement', statut: 'En cours' },
      { titre: 'Recette & mise en ligne', statut: 'À venir' },
    ],
    livrables: [{ nom: 'App mobile Djama Pay — dossier de cadrage.pdf', taille: '2,1 Mo' }],
    taches: [
      { id: 't1', titre: 'Splash screen', statut: 'termine', assigne: 'A. Diallo', temps: '5 h', priorite: 'Basse', ton: 'neutre' },
      { id: 't2', titre: 'Écran de paiement', statut: 'en_cours', assigne: 'M. Koné', temps: '20 h', priorite: 'Critique', ton: 'erreur' },
      { id: 't3', titre: 'Tests sur staging', statut: 'review', assigne: 'S. Traoré', temps: '8 h', priorite: 'Haute', ton: 'alerte' },
      { id: 't4', titre: 'Webhook Mobile Money', statut: 'a_faire', assigne: 'M. Koné', temps: '12 h', priorite: 'Critique', ton: 'erreur' },
    ],
    bugs: [
      { numero: 'BUG-2026-0087', titre: 'Erreur 500 page paiement', gravite: 'Critique', ton: 'erreur', statut: 'Confirmé', source: 'Tracker auto' },
      { numero: 'BUG-2026-0088', titre: 'Crash au démarrage Android 12', gravite: 'Majeure', ton: 'alerte', statut: 'Nouveau', source: 'Tracker auto' },
    ],
  },
  {
    id: 'refonte-azalai',
    nom: 'Refonte e-commerce Azalai',
    client: 'Azalai Hotels',
    clientId: 'azalai',
    type: 'Site web',
    statut: 'À risque',
    ton: 'erreur',
    deadline: '30/11/2026',
    repo: 'github.com/digicom/azalai-shop',
    prod: 'https://shop.azalaihotels.com',
    staging: 'https://staging.azalaihotels.com',
    trackerKey: 'digi_pub_77qx02bd',
    jalons: [
      { titre: 'Cadrage & maquettes', statut: 'Terminé' },
      { titre: 'Développement', statut: 'En cours' },
      { titre: 'Recette & mise en ligne', statut: 'À venir' },
    ],
    livrables: [],
    taches: [
      { id: 't1', titre: 'Audit de l existant', statut: 'termine', assigne: 'S. Traoré', temps: '10 h', priorite: 'Normale', ton: 'info' },
      { id: 't2', titre: 'Arborescence et maquettes', statut: 'en_cours', assigne: 'A. Diallo', temps: '18 h', priorite: 'Haute', ton: 'alerte' },
      { id: 't3', titre: 'Moteur de réservation', statut: 'a_faire', assigne: 'M. Koné', temps: '30 h', priorite: 'Critique', ton: 'erreur' },
    ],
    bugs: [
      { numero: 'BUG-2026-0075', titre: 'Double réservation possible', gravite: 'Critique', ton: 'erreur', statut: 'Nouveau', source: 'Manuel' },
    ],
  },
  {
    id: 'app-myorange',
    nom: 'App My Orange',
    client: 'Orange Mali',
    clientId: 'orange-mali',
    type: 'App mobile',
    statut: 'En review',
    ton: 'alerte',
    deadline: '05/10/2026',
    repo: 'github.com/digicom/my-orange',
    prod: 'Stores — review',
    staging: 'staging.myorange.ml',
    trackerKey: null,
    jalons: [
      { titre: 'Cadrage & maquettes', statut: 'Terminé' },
      { titre: 'Développement', statut: 'Terminé' },
      { titre: 'Recette & mise en ligne', statut: 'En cours' },
    ],
    livrables: [],
    taches: [
      { id: 't1', titre: 'Onboarding', statut: 'termine', assigne: 'A. Diallo', temps: '8 h', priorite: 'Normale', ton: 'info' },
      { id: 't2', titre: 'Espace conso data', statut: 'termine', assigne: 'M. Koné', temps: '14 h', priorite: 'Haute', ton: 'alerte' },
      { id: 't3', titre: 'Notifications push', statut: 'review', assigne: 'S. Traoré', temps: '6 h', priorite: 'Normale', ton: 'info' },
    ],
    bugs: [],
  },
];

/* Pont agence -> portail : retrouve le projet agence correspondant au projet
   vu côté client (même clientId, nom inclus l'un dans l'autre).
   Projets sans correspondance (ex. campagnes Com) : suivi mock côté client. */
export function getProjetSuivi(clientId, nomClient) {
  const n = String(nomClient).toLowerCase();
  return PROJETS.find((p) =>
    p.clientId === clientId &&
    (p.nom.toLowerCase().includes(n) || n.includes(p.nom.toLowerCase()) || p.nom.toLowerCase().split(' ').some((m) => m.length > 4 && n.includes(m))),
  ) ?? null;
}

export function ajouterJalon(projetId, titre) {
  const p = PROJETS.find((x) => x.id === projetId);
  if (!p) return null;
  const j = { titre: titre.trim(), statut: 'À venir' };
  p.jalons = [...(p.jalons ?? []), j];
  return j;
}

export function statuerJalon(projetId, titre, statut) {
  const p = PROJETS.find((x) => x.id === projetId);
  if (p) p.jalons = (p.jalons ?? []).map((j) => (j.titre === titre ? { ...j, statut } : j));
}

export function ajouterLivrable(projetId, { nom, taille }) {
  const p = PROJETS.find((x) => x.id === projetId);
  if (!p) return null;
  const l = { nom: nom.trim(), taille: taille.trim() || '—' };
  p.livrables = [...(p.livrables ?? []), l];
  return l;
}

/* Création projet — le dépôt est généré automatiquement depuis le nom
   (slug github.com/digicom/<slug>), modifiable ensuite dans le détail.
   Backend : POST /api/v1/projects/ (repo auto, override possible). */
export function slugifierProjet(nom) {
  return String(nom)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ajouterProjet({ nom, client, clientId, type, deadline }) {
  /* SPEC §5.4 : projet web -> clé tracker auto-générée + snippet à coller. */
  const estWeb = ['Site web', 'App web'].includes(type);
  const p = {
    id: `projet-${Date.now()}`,
    nom,
    client,
    clientId: clientId || '',
    type,
    statut: 'Nouveau',
    ton: 'info',
    deadline,
    repo: `github.com/digicom/${slugifierProjet(nom)}`,
    prod: '—',
    staging: '—',
    trackerKey: estWeb ? `digi_pub_${Math.random().toString(36).slice(2, 10)}` : null,
    taches: [],
    bugs: [],
    jalons: [],
    livrables: [],
  };
  PROJETS.unshift(p);
  return p;
}

export function majProjet(id, patch) {
  const p = PROJETS.find((x) => x.id === id);
  if (p) Object.assign(p, patch);
  return p;
}
