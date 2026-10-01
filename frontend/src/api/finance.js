import { api } from './client.js';
import { get, patch, post, suppr, toutLister } from './base.js';

/* Téléchargement authentifié (le JWT ne passe pas par window.open). */
export async function telechargerPdf(url, nom) {  const { data } = await api.get(url, { responseType: 'blob' });
  const lien = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = lien;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(lien);
}

export const listerDevis = (params) => toutLister('/finance/quotes/', params);
export const creerDevis = (payload) => post('/finance/quotes/', payload);
export const supprimerDevis = (id) => suppr(`/finance/quotes/${id}/`);
export const validerDevis = (id) => post(`/finance/quotes/${id}/valider/`, {});
export const rejeterDevis = (id) => post(`/finance/quotes/${id}/rejeter/`, {});
export const listerFactures = (params) => toutLister('/finance/invoices/', params);
export const detailFacture = (id) => get(`/finance/invoices/${id}/`);
export const creerFacture = (payload) => post('/finance/invoices/', payload);
export const majFacture = (id, payload) => patch(`/finance/invoices/${id}/`, payload);
export const payerFacture = (id, payload) => post(`/finance/invoices/${id}/payer/`, payload);
export const envoyerFacture = (id) => post(`/finance/invoices/${id}/envoyer/`, {});
export const pdfFacture = (id) => `/finance/invoices/${id}/pdf/`;
export const listerRecus = (params) => toutLister('/finance/receipts/', params);
export const pdfRecu = (id) => `/finance/receipts/${id}/pdf/`;
export const listerDepenses = (params) => toutLister('/finance/expenses/', params);
export const creerDepense = (payload) => post('/finance/expenses/', payload);
export const supprimerDepense = (id) => suppr(`/finance/expenses/${id}/`);
export const listerFichesPaie = (params) => toutLister('/finance/paie/', params);
export const detailFichePaie = (id) => get(`/finance/paie/${id}/`);
export const creerFichePaie = (payload) => post('/finance/paie/', payload);
export const ajouterLignePaie = (ficheId, payload) => post(`/finance/paie/${ficheId}/ajouter_ligne/`, payload);
export const majLignePaie = (ficheId, numero, payload) => patch(`/finance/paie/${ficheId}/lignes/${numero}/`, payload);
export const cloturerFichePaie = (ficheId) => post(`/finance/paie/${ficheId}/cloturer/`, {});
export const supprimerFichePaie = (ficheId) => suppr(`/finance/paie/${ficheId}/`);
export async function envoyerCachet(ficheId, fichier) {
  const form = new FormData();
  form.append('cachet', fichier);
  // Pas de Content-Type manuel : le navigateur ajoute multipart + boundary.
  const { data } = await api.post(`/finance/paie/${ficheId}/cachet/`, form);
  return data;
}
export const retirerCachet = (ficheId) => api.delete(`/finance/paie/${ficheId}/cachet/`).then((r) => r.data);
export const detailClient = (id) => get(`/clients/${id}/`);
export const overviewClient = (id) => get(`/clients/${id}/overview/`);
export const dashboardPortal = () => get('/portal/dashboard/');
