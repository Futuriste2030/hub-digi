"""JWT enrichi : le token embarque role/department/poste/client (SPEC §3). + 2FA TOTP (SPEC §10)."""

from django.core import signing
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.permissions import IsSuperAdmin

from .models import User


class OtpRequis(AuthenticationFailed):
    """Mot de passe OK mais 2FA active : le login répond 202 + temp_token."""

    def __init__(self, temp_token):
        self.temp_token = temp_token
        super().__init__("Code 2FA requis.")


def _totp_confirme(user):
    return TOTPDevice.objects.filter(user=user, confirmed=True).first()


class HubTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["department_id"] = user.department_id
        token["poste_id"] = user.poste_id
        token["client_id"] = user.client_id
        return token

    def validate(self, attrs):
        from django.db.models import Q

        # Identifiant client (ex. orange.mali) OU e-mail pro : les deux ouvrent.
        identifiant = (attrs.get("identifiant") or attrs.get("email") or attrs.get("username") or "").strip()
        try:
            user = User.objects.get(Q(email__iexact=identifiant) | Q(username__iexact=identifiant))
        except (User.DoesNotExist, ValueError):
            raise AuthenticationFailed("E-mail ou identifiant incorrect.", code="no_active_account")
        if not user.check_password(attrs.get("password", "")):
            raise AuthenticationFailed("E-mail ou identifiant incorrect.", code="no_active_account")
        if not user.is_active:
            raise AuthenticationFailed("Compte désactivé.", code="no_active_account")
        if user.role == "client" and user.client_id:
            from apps.clients.models import Client

            if Client.objects.filter(pk=user.client_id, est_interne=True).exists():
                raise AuthenticationFailed("Client interne : aucun espace client.", code="no_active_account")
        self.user = user
        refresh = self.get_token(user)
        data = {"refresh": str(refresh), "access": str(refresh.access_token)}
        if _totp_confirme(user) and user.role != "client":
            signer = signing.TimestampSigner(salt="hub-otp")
            raise OtpRequis(signer.sign(str(user.id)))
        return data


class HubTokenObtainPairView(TokenObtainPairView):
    serializer_class = HubTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except OtpRequis as exc:
            return Response({"otp_required": True, "temp_token": exc.temp_token}, status=202)


class OtpSetupView(APIView):
    """Active la 2FA : crée un device TOTP non confirmé, renvoie l'URI provisioning (QR)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role == "client":
            return Response({"detail": "2FA réservée aux comptes internes."}, status=403)
        if _totp_confirme(request.user):
            return Response({"detail": "2FA déjà active."}, status=400)
        TOTPDevice.objects.filter(user=request.user, confirmed=False).delete()
        device = TOTPDevice.objects.create(user=request.user, name="hub", confirmed=False)
        return Response({"otpauth_url": device.config_url, "secret": device.bin_key.hex()}, status=201)


class OtpConfirmView(APIView):
    """Confirme la 2FA avec un code de l'app authenticator."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        device = TOTPDevice.objects.filter(user=request.user, confirmed=False).order_by("-id").first()
        if not device:
            return Response({"detail": "Aucune activation en cours."}, status=400)
        if not device.verify_token(request.data.get("code", "")):
            return Response({"detail": "Code invalide."}, status=400)
        device.confirmed = True
        device.save()
        TOTPDevice.objects.filter(user=request.user, confirmed=False).delete()
        return Response({"detail": "2FA activée."})


class OtpVerifyView(APIView):
    """Échange temp_token + code 2FA contre les JWT (2e étape du login)."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            user_id = signing.TimestampSigner(salt="hub-otp").unsign(
                request.data.get("temp_token", ""), max_age=300
            )
            user = User.objects.get(id=user_id)
        except Exception:
            return Response({"detail": "Session 2FA expirée."}, status=400)
        device = _totp_confirme(user)
        if not device or not device.verify_token(request.data.get("code", "")):
            return Response({"detail": "Code invalide."}, status=400)
        refresh = HubTokenObtainPairSerializer.get_token(user)
        return Response({"refresh": str(refresh), "access": str(refresh.access_token)})


class OtpDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        TOTPDevice.objects.filter(user=request.user).delete()
        return Response({"detail": "2FA désactivée."}, status=204)


class OtpStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"active": _totp_confirme(request.user) is not None})


class PasswordResetRequestView(APIView):
    """Demande de reset : envoie le mail avec lien (réponse identique si e-mail inconnu)."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from django.conf import settings
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        from apps.mailing.services import send_templated_mail

        email = request.data.get("email", "").strip()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Si ce compte existe, un lien vient d'être envoyé."})
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        send_templated_mail(
            "reset_password", user.email,
            {"nom": user.get_full_name() or user.username, "reset_url": reset_url},
        )
        return Response({"detail": "Si ce compte existe, un lien vient d'être envoyé."})


class PasswordResetConfirmView(APIView):
    """Validation du reset : uid + token + nouveau mot de passe."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        try:
            uid = force_str(urlsafe_base64_decode(request.data.get("uid", "")))
            user = User.objects.get(pk=uid)
        except Exception:
            return Response({"detail": "Lien invalide."}, status=400)
        token = request.data.get("token", "")
        nouveau = request.data.get("new_password", "")
        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Lien invalide ou expiré."}, status=400)
        if len(nouveau) < 8:
            return Response({"new_password": "8 caractères minimum."}, status=400)
        user.set_password(nouveau)
        user.save()
        return Response({"detail": "Mot de passe réinitialisé."})


class PasswordChangeView(APIView):
    """Changement direct (connecté) : vérifie l'actuel puis définit le nouveau (Profil).
    Si la 2FA est active, le code OTP est exigé en plus."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.check_password(request.data.get("current_password", "")):
            return Response({"detail": "Mot de passe actuel incorrect."}, status=400)
        if _totp_confirme(user):
            device = _totp_confirme(user)
            if not device.verify_token(request.data.get("code", "")):
                return Response({"code": "Code 2FA requis ou invalide."}, status=400)
        nouveau = request.data.get("new_password", "")
        if len(nouveau) < 8:
            return Response({"new_password": "8 caractères minimum."}, status=400)
        user.set_password(nouveau)
        user.save()
        return Response({"detail": "Mot de passe modifié."})


class UserSerializer(serializers.ModelSerializer):
    department_nom = serializers.CharField(source="department.nom", read_only=True)
    poste_titre = serializers.CharField(source="poste.titre", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "first_name", "last_name",
            "role", "department", "department_nom", "poste", "poste_titre",
            "client", "is_active",
        ]
        read_only_fields = ["id"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "username", "password", "role", "department", "poste", "client"]

    def validate(self, attrs):
        from apps.clients.models import Client

        if attrs.get("role") == "client":
            client = attrs.get("client")
            if isinstance(client, Client):
                client_obj = client
            elif client is not None:
                client_obj = Client.objects.filter(pk=client).first()
            else:
                client_obj = None
            if client_obj is not None and client_obj.est_interne:
                raise serializers.ValidationError(
                    {"client": "Client interne (ex. Digi Com) : aucun compte espace client ne doit être créé."}
                )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("department", "poste", "client").all()
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["role", "department", "client", "is_active"]
    search_fields = ["email", "username", "first_name", "last_name"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user).data)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        """Reset admin du mot de passe (super_admin) — SPEC §3 : sans envoi auto,
        l'opérateur transmet ensuite via le template bienvenue (Bouton Envoyer)."""
        user = self.get_object()
        nouveau = request.data.get("new_password", "")
        if len(nouveau) < 8:
            return Response({"new_password": "8 caractères minimum."}, status=400)
        user.set_password(nouveau)
        user.save()
        return Response({"detail": "Mot de passe réinitialisé.", "username": user.username})


class UserMiniView(APIView):
    """Liste minimale pour les selects — tout interne authentifié.
    Inclut prénom/nom + poste pour pré-remplir la fiche employé (RH).
    Clients et super admin exclus (un seul super admin superviseur)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.exclude(role__in=["client", "super_admin"]).order_by("email").values(
            "id", "email", "role", "first_name", "last_name",
            "poste__titre", "department__nom",
        )
        return Response([
            {"id": u["id"], "email": u["email"], "role": u["role"],
             "first_name": u["first_name"] or "", "last_name": u["last_name"] or "",
             "poste_titre": u["poste__titre"] or "", "department_nom": u["department__nom"] or ""}
            for u in users
        ])
