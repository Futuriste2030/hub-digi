"""Endpoints biométrie : enregistrement (connecté) + login (public).

Le login mdp + OTP reste inchangé. Après passkey valide : JWT directs, sauf
TOTP active (non-client) → même 202 + temp_token que le login mdp.
"""

import json
from urllib.parse import urlparse

from django.conf import settings
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from apps.accounts.models import User

from .models import PasskeyChallenge, PasskeyCredential

RP_NOM = "HUB DIGI"


def _rp_id():
    return urlparse(settings.FRONTEND_URL or "http://localhost:5199").hostname or "localhost"


def _origine():
    return (settings.FRONTEND_URL or "http://localhost:5199").rstrip("/")


def _trouver_user(identifiant):
    try:
        return User.objects.get(Q(email__iexact=identifiant) | Q(username__iexact=identifiant))
    except (User.DoesNotExist, ValueError):
        return None


def _jwt_ou_otp(user):
    """Même contrat que le login mdp : JWT ou 202 OTP si TOTP active."""
    from django.core import signing

    from apps.accounts.views import HubTokenObtainPairSerializer, OtpRequis, _totp_confirme

    if not user.is_active:
        return Response({"detail": "Compte désactivé."}, status=400)
    if _totp_confirme(user) and user.role != "client":
        signer = signing.TimestampSigner(salt="hub-otp")
        raise OtpRequis(signer.sign(str(user.id)))
    refresh = HubTokenObtainPairSerializer.get_token(user)
    return Response({"refresh": str(refresh), "access": str(refresh.access_token)})


class PasskeyRegisterBeginView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        existants = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
            for c in request.user.passkeys.all()
        ]
        options = generate_registration_options(
            rp_id=_rp_id(),
            rp_name=RP_NOM,
            user_id=str(request.user.id).encode(),
            user_name=request.user.email,
            user_display_name=request.user.get_full_name() or request.user.username,
            exclude_credentials=existants,
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                user_verification=UserVerificationRequirement.PREFERRED,
                resident_key=ResidentKeyRequirement.PREFERRED,
            ),
        )
        PasskeyChallenge.objects.create(
            user=request.user, email=request.user.email,
            challenge=bytes_to_base64url(options.challenge),
            usage=PasskeyChallenge.REGISTRATION,
        )
        return Response(json.loads(options_to_json(options)))


class PasskeyRegisterCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        donnees = request.data.get("credential") or {}
        reponse_client = donnees.get("response") or {}
        defi = PasskeyChallenge.consommer(
            reponse_client.get("clientDataJSON") and _extraire_challenge(donnees),
            PasskeyChallenge.REGISTRATION,
        )
        if defi is None:
            return Response({"detail": "Session d'enregistrement expirée, recommencez."}, status=400)
        try:
            verifie = verify_registration_response(
                credential=donnees,
                expected_challenge=defi,
                expected_rp_id=_rp_id(),
                expected_origin=_origine(),
            )
        except Exception:
            return Response({"detail": "Enregistrement refusé par le serveur."}, status=400)
        cred_id = bytes_to_base64url(verifie.credential_id)
        PasskeyCredential.objects.update_or_create(
            credential_id=cred_id,
            defaults={
                "user": request.user,
                "cle_publique": bytes_to_base64url(verifie.credential_public_key),
                "compteur_signature": verifie.sign_count,
                "nom": (request.data.get("nom") or "Mon appareil")[:100],
            },
        )
        return Response({"detail": "Biométrie activée sur cet appareil."}, status=201)


def _extraire_challenge(donnees):
    """Retrouve le challenge d'origine depuis clientDataJSON (base64url)."""
    import base64
    import json

    try:
        brut = donnees.get("response", {}).get("clientDataJSON", "")
        rembourre = "=" * ((4 - len(brut) % 4) % 4)
        client = json.loads(base64.urlsafe_b64decode(brut + rembourre))
        return client.get("challenge", "")
    except Exception:
        return ""


class PasskeyLoginBeginView(APIView):
    """Identifiant optionnel : renseigné → passkeys du compte ; vide →
    découverte côté appareil (clé résidente), compte retrouvé au complete."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        identifiant = (request.data.get("identifiant") or "").strip()
        user = _trouver_user(identifiant) if identifiant else None
        if identifiant and (user is None or not user.is_active):
            return Response({"detail": "E-mail ou identifiant incorrect."}, status=400)
        creds = list(user.passkeys.all()) if user else []
        if user and not creds:
            return Response({"detail": "Aucune biométrie enregistrée pour ce compte, utilisez le mot de passe."}, status=400)
        options = generate_authentication_options(
            rp_id=_rp_id(),
            allow_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id)) for c in creds],
            user_verification=UserVerificationRequirement.PREFERRED,
        )
        PasskeyChallenge.objects.create(
            user=user, email=user.email if user else "",
            challenge=bytes_to_base64url(options.challenge),
            usage=PasskeyChallenge.AUTHENTICATION,
        )
        return Response(json.loads(options_to_json(options)))


class PasskeyLoginCompleteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from apps.accounts.views import OtpRequis

        identifiant = (request.data.get("identifiant") or "").strip()
        donnees = request.data.get("credential") or {}
        user = _trouver_user(identifiant) if identifiant else None
        if identifiant and user is None:
            return Response({"detail": "E-mail ou identifiant incorrect."}, status=400)
        cred_id = (donnees.get("id") or "").replace("=", "")
        try:
            cred = user.passkeys.get(credential_id=cred_id) if user else PasskeyCredential.objects.get(credential_id=cred_id)
        except PasskeyCredential.DoesNotExist:
            return Response({"detail": "Appareil non reconnu."}, status=400)
        user = cred.user
        if not user.is_active:
            return Response({"detail": "Compte désactivé."}, status=400)
        defi = PasskeyChallenge.consommer(
            _extraire_challenge(donnees), PasskeyChallenge.AUTHENTICATION)
        if defi is None:
            return Response({"detail": "Session expirée, recommencez."}, status=400)
        try:
            verifie = verify_authentication_response(
                credential=donnees,
                expected_challenge=defi,
                expected_rp_id=_rp_id(),
                expected_origin=_origine(),
                credential_public_key=base64url_to_bytes(cred.cle_publique),
                credential_current_sign_count=cred.compteur_signature,
            )
        except Exception:
            return Response({"detail": "Authentification biométrique refusée."}, status=400)
        from django.utils import timezone

        cred.compteur_signature = verifie.new_sign_count
        cred.dernier_usage = timezone.now()
        cred.save()
        try:
            return _jwt_ou_otp(user)
        except OtpRequis as exc:
            return Response({"otp_required": True, "temp_token": exc.temp_token}, status=202)


class PasskeyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([{
            "id": c.id, "nom": c.nom,
            "cree_le": c.cree_le, "dernier_usage": c.dernier_usage,
        } for c in request.user.passkeys.all()])

    def delete(self, request, pk=None):
        request.user.passkeys.filter(id=pk).delete()
        return Response(status=204)
