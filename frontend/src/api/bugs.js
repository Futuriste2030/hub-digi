import { post, patch, toutLister } from './base.js';
import { listerProjets } from './projets.js';

export { listerProjets };
export const listerBugs = (params) => toutLister('/bugs/', params);
export const creerBug = (payload) => post('/bugs/', payload);
export const majBug = (id, payload) => patch(`/bugs/${id}/`, payload);
export const convertirBug = (id) => post(`/bugs/${id}/convertir/`, {});
