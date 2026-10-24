"""Liens de paiement publics — un lien unique, stable et signé par document.

Deux liens distincts, tous deux figés dans les QR imprimés :

  - `/paiement/facture/<numero>`  : lien de PAIEMENT de la facture (unique par
    facture, stable dans le temps : il survit aux relances et aux rappels).
  - `/paiement/recu/<numero>`     : lien de VÉRIFICATION du reçu généré après
    le paiement (propagé au reçu, comme demandé).

Le lien reste identique tant que le numéro du document ne change pas : le
montant, lui, est TOUJOURS recalculé par le serveur à l'ouverture. C'est ce
qui garantit le respect des montants : le client ne peut pas altérer le QR.
"""

from django.conf import settings

from .signing import signer_facture, signer_recu


def paiement_en_ligne_actif():
    """Paiement en ligne disponible.

    Deux interrupteurs : PAYMENT_ENABLED (master, sortie neutralisée) et
    LIGDICASH_ENABLED (fournisseur). Les deux doivent être à 1 — sinon aucun
    lien n'est distribué (pas de QR mort, pas de bouton de mail inutile).
    """
    return bool(getattr(settings, "PAYMENT_ENABLED", False)
                and getattr(settings, "LIGDICASH_ENABLED", False))


def _base():
    return settings.FRONTEND_URL.rstrip("/")


def lien_paiement_facture(numero):
    """Lien unique de paiement d'une facture (page publique, signée)."""
    if not numero or not paiement_en_ligne_actif():
        return ""
    return f"{_base()}/paiement/facture/{numero}?sig={signer_facture(numero)}"


def lien_verification_recu(numero):
    """Lien unique de vérification d'un reçu (page publique, signée)."""
    if not numero or not paiement_en_ligne_actif():
        return ""
    return f"{_base()}/paiement/recu/{numero}?sig={signer_recu(numero)}"


def signature_facture(numero):
    return signer_facture(numero)
