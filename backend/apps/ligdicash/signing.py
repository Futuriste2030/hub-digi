"""Signature des liens publics — un lien unique, stable et non devinable par document.

Le QR imprimé sur la facture doit pointer vers une page de paiement stable
(même URL d'une facture à l'autre, pour que le QR survive aux relances) mais
privée : n'importe qui ne doit pas pouvoir deviner « FACTURE-SONATEL-...-12 »
et régler la facture d'autrui.

On signe donc le numéro du document avec le SECRET_KEY Django (HMAC-SHA256).
La signature est un paramètre d'URL : `?sig=<hex>`. Elle est recalculable à
volonté (donc figable dans un QR) et invérifiable sans le SECRET_KEY.

L'implémentation est mutualisée dans `apps.core.signing` (partagée avec les
attestations de formation) — ici on ne garde que les contextes « paiement ».
"""

from apps.core.signing import LONGUEUR_SIGNATURE, signer, verifier  # noqa: F401


def signer_facture(numero: str) -> str:
    return signer(numero or "", "facture")


def signer_recu(numero: str) -> str:
    return signer(numero or "", "recu")


def signer_transaction(transaction_id: str) -> str:
    return signer(transaction_id or "", "transaction")
