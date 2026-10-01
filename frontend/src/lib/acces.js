/* Listes de rôles par périmètre — source unique du filtrage par rôle (mock).
   Règle : super_admin partout ; admin = transverse hors Dév/Com/Finance/Juridique
   (pas d'internes techniques ni financiers) ; chefs = leur dept + transverse
   lecture ; membres = leur dept, exécution uniquement.
   BACKEND : permissions DRF (IsDepartmentMember + niveau), le frontend ne fait que masquer. */

export const ROLE_SUPER = 'super_admin';
export const ROLE_ADMIN = 'admin';

export const INTERNES = [
  'super_admin', 'admin',
  'chef_com', 'membre_com', 'chef_dev', 'membre_dev',
  'chef_finance', 'membre_finance', 'chef_rh', 'membre_rh',
  'chef_juridique', 'membre_juridique',
];
export const CHEFS = [
  'super_admin', 'admin',
  'chef_com', 'chef_dev', 'chef_finance', 'chef_rh', 'chef_juridique',
];

export const ROLES_DEV = ['super_admin', 'chef_dev', 'membre_dev'];
export const ROLES_COM = ['super_admin', 'chef_com', 'membre_com'];
export const ROLES_FINANCE = ['super_admin', 'chef_finance', 'membre_finance'];
export const ROLES_RH = ['super_admin', 'admin', 'chef_rh', 'membre_rh'];
export const ROLES_JURIDIQUE = ['super_admin', 'chef_juridique', 'membre_juridique'];
export const ROLES_SECRETARIAT = ['super_admin', 'admin'];
export const ROLES_ADMIN = ['super_admin', 'admin'];
/* Validation / écriture sensibles : chefs + super_admin (admin inclus si transverse). */
export const ROLES_CHEF_DEV = ['super_admin', 'chef_dev'];
export const ROLES_CHEF_COM = ['super_admin', 'chef_com'];
export const ROLES_CHEF_FINANCE = ['super_admin', 'chef_finance'];
export const ROLES_CHEF_RH = ['super_admin', 'admin', 'chef_rh'];
export const ROLES_CHEF_JURIDIQUE = ['super_admin', 'chef_juridique'];

/* Création clients : super_admin, admin et chefs de département. */
export const ROLES_CREATION_CLIENT = [...CHEFS];

/* Vrai si la session possède l'un des rôles autorisés. */
export const peutVoir = (session, roles) => roles.includes(session?.role);

/* Rôle chef du département assigné (aval tickets). */
const CHEF_PAR_DEPT = {
  Développement: 'chef_dev',
  Communication: 'chef_com',
  Finance: 'chef_finance',
  RH: 'chef_rh',
  Juridique: 'chef_juridique',
  Administration: 'admin',
};
export const estChefDuDept = (session, dept) =>
  session?.role === 'super_admin' || (dept && session?.role === CHEF_PAR_DEPT[dept]);

/* Slug département pour les routes : « Développement » -> « developpement ». */
export const slugDepartement = (nom) =>
  String(nom ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* Page d'accueil par rôle : super_admin -> /dashboard, autres -> /dashboard/:departement. */
export const urlTableauDeBord = (session) => {
  if (!session) return '/login';
  if (session.role === 'super_admin') return '/dashboard';
  if (session.role === 'client') return '/espace';
  const slug = slugDepartement(session.dept);
  return slug ? `/dashboard/${slug}` : '/dashboard';
};

/* URL portail client personnalisée : /espace/:slug/:code (code unique 4 chiffres).
   Sans slug/code (ex. session seule) -> /espace (résolution côté portail). */
export const urlEspace = (client) => {
  if (client?.slug && client?.code) return `/espace/${client.slug}/${client.code}`;
  if (client?.id) return `/espace/${client.id}`;
  return '/espace';
};
