"""Lien public de vérification d'une attestation.

Comme le lien de paiement d'une facture, il est unique, stable et signé :
`{FRONTEND_URL}/attestation/<numero>?sig=<HMAC>`. Le HMAC porte sur le
numéro d'attestation avec le contexte « attestation » — une signature de
facture ne peut donc pas servir à vérifier une attestation.

La page publique affiche l'attestation ENREGISTRÉE dans le HUB (participant,
formation, dates, numéro) : c'est une source de vérité, pas une capture.
"""

from django.conf import settings

from .signing import signer_attestation, verifier_attestation


def lien_verification_attestation(numero: str) -> str:
    """Lien public de vérification (le QR de l'attestation encode cette URL)."""
    if not numero:
        return ""
    base = (getattr(settings, "FRONTEND_URL", "") or "https://hub.digicom.ml").rstrip("/")
    return f"{base}/attestation/{numero}?sig={signer_attestation(numero)}"


def verifier_lien(numero: str, signature: str) -> bool:
    """Signature valide pour ce numéro d'attestation ?"""
    return verifier_attestation(numero, signature)
