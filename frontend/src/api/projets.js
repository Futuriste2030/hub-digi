import { get, post, patch, suppr, toutLister } from './base.js';

export const listerProjets = (params) => toutLister('/projects/', params);
export const detailProjet = (id) => get(`/projects/${id}/`);
export const creerProjet = (payload) => post('/projects/', payload);
export const supprimerProjet = (id) => suppr(`/projects/${id}/`);
export const tachesProjet = (id) => get(`/projects/${id}/tasks/`);
export const jalonsProjet = (id) => get(`/projects/${id}/milestones/`);
export const listerTaches = (params) => toutLister('/tasks/', params);
export const creerTache = (payload) => post('/tasks/', payload);
export const majTache = (id, payload) => patch(`/tasks/${id}/`, payload);
export const supprimerTache = (id) => suppr(`/tasks/${id}/`);
export const creerJalon = (payload) => post('/milestones/', payload);
export const majJalon = (id, payload) => patch(`/milestones/${id}/`, payload);
export const supprimerJalon = (id) => suppr(`/milestones/${id}/`);
export const listerBugs = (params) => toutLister('/bugs/', params);
export const majBug = (id, payload) => patch(`/bugs/${id}/`, payload);
export const convertirBug = (id) => post(`/bugs/${id}/convertir/`, {});

/* Sprints & backlog (SPEC Jira §2) : canonique /sprints/, alias /dev/sprints/ côté API. */
export const listerSprints = (params) => toutLister('/sprints/', params);
export const creerSprint = (payload) => post('/sprints/', payload);
export const majSprint = (id, payload) => patch(`/sprints/${id}/`, payload);
export const demarrerSprint = (id) => post(`/sprints/${id}/demarrer/`, {});
export const terminerSprint = (id, payload) => post(`/sprints/${id}/terminer/`, payload ?? {});
export const rapportSprint = (id) => get(`/sprints/${id}/rapport/`);
export const backlogProjet = (id) => get(`/projects/${id}/backlog/`);
export const velociteProjet = (id, n) => get(`/projects/${id}/velocite/${n ? `?n=${n}` : ''}`);

/* GitHub entrant V1 (§4) + liens commits/PR. */
export const regenererSecretGithub = (id) => post(`/projects/${id}/github/regenerer-secret/`, {});
export const livraisonsGithub = (id) => get(`/projects/${id}/github/livraisons/`);
export const majProjetGithub = (id, payload) => patch(`/projects/${id}/`, payload);
export const listerLiensGit = (params) => toutLister('/liens-git/', params);
export const liensTache = (id) => get(`/tasks/${id}/liens-git/`);

/* Recherche globale (§5). */
export const rechercheGlobale = (q) => get(`/search/?q=${encodeURIComponent(q)}`);
