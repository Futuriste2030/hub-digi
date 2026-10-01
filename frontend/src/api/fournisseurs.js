import { get, patch, post, suppr, toutLister } from './base.js';

/* Ressource Fournisseurs — DRF /fournisseurs/ + factures d'achat + paiements. */

export const listerFournisseurs = (params) => toutLister('/fournisseurs/', params);
export const creerFournisseur = (payload) => post('/fournisseurs/', payload);
export const majFournisseur = (id, payload) => patch(`/fournisseurs/${id}/`, payload);
export const supprimerFournisseur = (id) => suppr(`/fournisseurs/${id}/`);
export const overviewFournisseur = (id) => get(`/fournisseurs/${id}/overview/`);

export const listerFacturesFournisseurs = (params) => toutLister('/fournisseurs-factures/', params);
export const creerFactureFournisseur = (payload) => post('/fournisseurs-factures/', payload);
export const validerFactureFournisseur = (id) => post(`/fournisseurs-factures/${id}/valider/`, {});
export const payerFactureFournisseur = (id, payload) => post(`/fournisseurs-factures/${id}/payer/`, payload);
export const supprimerFactureFournisseur = (id) => suppr(`/fournisseurs-factures/${id}/`);

export const listerPaiementsFournisseurs = (params) => toutLister('/fournisseurs-paiements/', params);

export const listerCommandes = (params) => toutLister('/fournisseurs-commandes/', params);
export const creerCommande = (payload) => post('/fournisseurs-commandes/', payload);
export const validerCommande = (id) => post(`/fournisseurs-commandes/${id}/valider/`, {});
export const envoyerCommande = (id) => post(`/fournisseurs-commandes/${id}/envoyer/`, {});
export const convertirCommande = (id) => post(`/fournisseurs-commandes/${id}/convertir/`, {});
export const supprimerCommande = (id) => suppr(`/fournisseurs-commandes/${id}/`);
export const pdfCommande = (id) => `/fournisseurs-commandes/${id}/pdf/`;

export const listerLivraisons = (params) => toutLister('/fournisseurs-livraisons/', params);
export const creerLivraison = (payload) => post('/fournisseurs-livraisons/', payload);
export const validerLivraison = (id) => post(`/fournisseurs-livraisons/${id}/valider/`, {});
export const pdfLivraison = (id) => `/fournisseurs-livraisons/${id}/pdf/`;

export const pdfFactureFournisseur = (id) => `/fournisseurs-factures/${id}/pdf/`;
export const pdfPaiementFournisseur = (id) => `/fournisseurs-paiements/${id}/pdf/`;
