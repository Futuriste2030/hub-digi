import { get, patch, post, suppr, toutLister } from './base.js';
import { api } from './client.js';

export const listerTickets = (params) => toutLister('/tickets/', params);
export const creerTicket = (payload) => post('/tickets/', payload);
export const messagesTicket = (id) => get(`/tickets/${id}/messages/`);
export const approvalsTicket = (id) => get(`/tickets/${id}/approvals/`);
export const cloreTicket = (id) => post(`/tickets/${id}/clore/`, {});
export const rouvrirTicket = (id) => post(`/tickets/${id}/rouvrir/`, {});
export const rejeterTicket = (id, motif) => post(`/tickets/${id}/rejeter/`, { motif });
export const qualifierTicket = (id, payload) => post(`/tickets/${id}/qualify/`, payload);
export const demanderAval = (id, payload) => post(`/tickets/${id}/request_approval/`, payload);
export const donnerAval = (id, payload) => post(`/tickets/${id}/approve/`, payload);
export const repondreTicket = (id, payload) => post(`/tickets/${id}/reply/`, payload);
export const listerCourriers = (params) => toutLister('/secretariat/courriers/', params);
export const creerCourrier = (payload) => post('/secretariat/courriers/', payload);
export const majCourrier = (id, payload) => patch(`/secretariat/courriers/${id}/`, payload);
export const supprimerCourrier = (id) => suppr(`/secretariat/courriers/${id}/`);
export const listerDocuments = (params) => toutLister('/secretariat/documents/', params);
export const creerDocument = (payload) => post('/secretariat/documents/', payload);
export const majDocument = (id, payload) => patch(`/secretariat/documents/${id}/`, payload);
export const supprimerDocument = (id) => suppr(`/secretariat/documents/${id}/`);
export const listerReunions = (params) => toutLister('/secretariat/reunions/', params);
export const detailReunion = (id) => get(`/secretariat/reunions/${id}/`);
export const creerReunion = (payload) => post('/secretariat/reunions/', payload);
export const majReunion = (id, payload) => patch(`/secretariat/reunions/${id}/`, payload);
export const supprimerReunion = (id) => suppr(`/secretariat/reunions/${id}/`);
export const ajouterDecision = (reunionId, payload) => post(`/secretariat/reunions/${reunionId}/decider/`, payload);
export const convertirDecision = (reunionId, decId, projectId) =>
  post(`/secretariat/reunions/${reunionId}/decisions/${decId}/convertir/`, { project_id: projectId });
export const listerDecharges = (params) => toutLister('/secretariat/decharges/', params);
/* Upload scan : multipart (le JSON ne transporte pas les fichiers).
   Le serveur compresse (JPEG 1600px q70) avant stockage. */
export async function creerDecharge({ provenance, objet, montant, date_recue, image, commentaire }) {
  const form = new FormData();
  form.append('provenance', provenance);
  form.append('objet', objet);
  if (montant !== '' && montant != null) form.append('montant', montant);
  if (date_recue) form.append('date_recue', date_recue);
  form.append('image', image);
  if (commentaire) form.append('commentaire', commentaire);
  // Pas de Content-Type manuel : le navigateur ajoute multipart + boundary.
  const { data } = await api.post('/secretariat/decharges/', form);
  return data;
}
export const supprimerDecharge = (id) => suppr(`/secretariat/decharges/${id}/`);
