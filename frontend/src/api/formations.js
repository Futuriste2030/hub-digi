import { get, patch, post, suppr, toutLister } from './base.js';
import { api } from './client.js';
import { payerFacture, telechargerPdf } from './finance.js';

/* Formations : inscriptions vitrine + factures + WhatsApp + pilotage. */

export const listerInscriptionsFormation = (params) => toutLister('/formations/inscriptions/', params);
export const supprimerInscriptionFormation = (id) => suppr(`/formations/inscriptions/${id}/`);
export const statsFormations = () => get('/formations/inscriptions/stats/');
export const whatsappFacture = (id) => post(`/finance/invoices/${id}/whatsapp/`, {});
export const detailFormation = (id) => get(`/formations/catalogue/${id}/`);
export const majFormation = (id, payload) => patch(`/formations/catalogue/${id}/`, payload);
export const majStatutInscription = (id, statut) => patch(`/formations/inscriptions/${id}/`, { statut });

/* --- Attestations de formation ---
   Le lien public de vérification est signé par le backend : le frontend ne
   le construit jamais, il utilise celui renvoyé par l'API. */
export const listerAttestations = (params) => toutLister('/formations/attestations/', params);
export const detailAttestation = (id) => get(`/formations/attestations/${id}/`);
export const attestationPublique = (numero, sig) => get(`/formations/verification/${numero}/`, { sig });
export const genererAttestation = (inscriptionId, payload = {}) =>
  post(`/formations/inscriptions/${inscriptionId}/attestation/`, payload);
export const genererAttestationsFormation = (formationId, payload = {}) =>
  post(`/formations/catalogue/${formationId}/attestations/`, payload);
export const pdfAttestation = (id) => `/formations/attestations/${id}/pdf/`;

/* ZIP des attestations d'une formation (téléchargement authentifié). */
export async function telechargerZipAttestations(formationId, nom) {
  const { data } = await api.get(`/formations/catalogue/${formationId}/attestations/zip/`, {
    responseType: 'blob',
  });
  const lien = URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = lien;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(lien);
}

/* wa.me : texte seul, pas de pièce jointe — le message contient facture + montant. */
export function ouvrirWhatsapp(telephone, message) {
  const url = `https://wa.me/${telephone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
}

export { payerFacture, telechargerPdf };
