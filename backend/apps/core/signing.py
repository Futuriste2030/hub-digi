"""Signature HMAC des liens publics — utilitaire mutualisé.

Un lien public (QR de facture, lien de reçu, lien d'attestation) doit être
- stable : le même QR imprimé doit rester valide d'une relance à l'autre ;
- non devinable : on ne doit pas pouvoir deviner « FACTURE-SONATEL-…-12 » ;
- invérifiable sans le SECRET_KEY.

On signe donc `contexte:objet` en HMAC-SHA256 avec le SECRET_KEY Django, et
on compare à temps constant (pas de fuite par timing).

Le « contexte » isole les usages : une signature de facture ne peut pas servir
de signature de reçu, ni d'attestation.
"""

import hashlib
import hmac

from django.conf import settings

LONGUEUR_SIGNATURE = 32


def signer(objet: str, contexte: str = "") -> str:
    """HMAC-SHA256 tronqué sur `contexte:objet`, dérivé du SECRET_KEY Django."""
    message = f"{contexte}:{objet}".encode("utf-8")
    cle = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(cle, message, hashlib.sha256).hexdigest()[:LONGUEUR_SIGNATURE]


def verifier(objet: str, contexte: str, signature: str) -> bool:
    """Comparaison à temps constant : pas de fuite par timing."""
    if not objet or not signature:
        return False
    return hmac.compare_digest(signer(objet, contexte), signature)
