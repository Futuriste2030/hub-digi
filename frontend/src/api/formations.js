import { get, post, toutLister } from './base.js';
import { payerFacture, telechargerPdf } from './finance.js';

/* Formations : inscriptions vitrine + factures + WhatsApp + pilotage. */

export const listerInscriptionsFormation = (params) => toutLister('/formations/inscriptions/', params);
export const statsFormations = () => get('/formations/inscriptions/stats/');
export const whatsappFacture = (id) => post(`/finance/invoices/${id}/whatsapp/`, {});

/* wa.me : texte seul, pas de pièce jointe — le message contient facture + montant. */
export function ouvrirWhatsapp(telephone, message) {
  const url = `https://wa.me/${telephone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
}

export { payerFacture, telechargerPdf };
