"""Signature des liens d'attestation — contexte isolé du paiement.

Le lien public de vérification d'une attestation est signé comme celui d'une
facture : HMAC-SHA256 sur le numéro d'attestation, avec un contexte
« attestation » — une signature de facture ne peut donc pas servir à
vérifier une attestation (et réciproquement).
"""

from apps.core.signing import signer, verifier


def signer_attestation(numero: str) -> str:
    return signer(numero or "", "attestation")


def verifier_attestation(numero: str, signature: str) -> bool:
    return verifier(numero or "", "attestation", signature)
