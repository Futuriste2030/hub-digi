/* Paiement en ligne — feature flag + liens uniques par document (SPEC §5.7/§6).
   VITE_PAIEMENT_ACTIF=true  -> parcours en ligne actif (LigdiCash, payin redirect).
   Toute autre valeur / absent -> parcours en ligne masqué, logique conservée.
   L'encaissement manuel guichet interne (espèces/virement + payerFacture API)
   reste actif : ce n'est pas du paiement en ligne.

   Les liens de paiement sont SIGNÉS par le backend (HMAC sur le SECRET_KEY) :
   un lien unique et stable par facture (figé dans le QR de la facture) et un
   lien unique par reçu (figé dans le QR du reçu généré après le paiement).
   Le frontend ne les construit donc jamais : il utilise ceux renvoyés par
   l'API (`lien_paiement` sur une facture, `lien_verification` sur un reçu). */

export const PAIEMENT_EN_LIGNE_ACTIF = import.meta.env.VITE_PAIEMENT_ACTIF === 'true';

export const MESSAGE_PAIEMENT_BIENTOT =
  'Paiement en ligne bientôt disponible — contactez l\u2019agence pour régler cette facture.';

/* Copie un lien de paiement fourni par l'API (donc déjà signé). */
export const copierLienPaiement = async (lien) => {
  if (!lien) return false;
  try {
    await navigator.clipboard.writeText(lien);
    return true;
  } catch {
    return false;
  }
};
