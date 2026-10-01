/* Libellés de rôles (SPEC §3) — source d'affichage partagée.
   Les données session/mock ont été supprimées : la session vient du store auth (JWT). */

export const LIBELLES_ROLE = {
  super_admin: 'Super Admin',
  admin: 'Administration',
  chef_com: 'Chef Communication',
  membre_com: 'Membre Communication',
  chef_dev: 'Chef Développement',
  membre_dev: 'Membre Développement',
  chef_finance: 'Chef Finance',
  membre_finance: 'Membre Finance',
  chef_rh: 'Chef RH',
  membre_rh: 'Membre RH',
  chef_juridique: 'Chef Juridique',
  membre_juridique: 'Membre Juridique',
  client: 'Client',
};
