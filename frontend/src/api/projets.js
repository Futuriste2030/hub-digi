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
