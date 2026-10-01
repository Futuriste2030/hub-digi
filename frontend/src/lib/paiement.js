/* Paiement en ligne — feature flag pour mise en ligne sans gateway (SPEC §5.7/§6).
   VITE_PAIEMENT_ACTIF=true  -> parcours en ligne actif (pay.digicom.ml branché).
   Toute autre valeur / absent -> parcours en ligne masqué, logique conservée.
   L'encaissement manuel guichet interne (espèces/virement + payerFacture API)
   reste actif : ce n'est pas du paiement en ligne. */

export const PAIEMENT_EN_LIGNE_ACTIF = import.meta.env.VITE_PAIEMENT_ACTIF === 'true';

export const MESSAGE_PAIEMENT_BIENTOT =
  'Paiement en ligne bientôt disponible — contactez l\u2019agence pour régler cette facture.';

export const lienPaiementFacture = (numero) =>
  PAIEMENT_EN_LIGNE_ACTIF ? `https://pay.digicom.ml/f/${numero}` : '';

export const lienVerifRecu = (numero, facture, montant) =>
  PAIEMENT_EN_LIGNE_ACTIF
    ? `https://pay.digicom.ml/r/${numero}?facture=${facture}&montant=${montant}`
    : `HUB-DIGI:${numero}:${facture}:${montant}`;
