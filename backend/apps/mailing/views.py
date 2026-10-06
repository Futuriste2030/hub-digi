"""Mailing API — SPEC §8/§12 : /mailing/send/ + /mailing/sent/."""

from django.core.validators import validate_email
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailIdentity, MailTemplate, SentMail


def normaliser_cc(brut):
    """Accepte liste ou chaîne (virgules/points-virgules) -> chaîne normalisée. Lève ValueError si invalide."""
    if not brut:
        return ""
    adresses = brut if isinstance(brut, list) else str(brut).replace(";", ",").split(",")
    propres = []
    for a in adresses:
        a = a.strip().lower()
        if not a:
            continue
        validate_email(a)
        if a not in propres:
            propres.append(a)
    if isinstance(brut, str) and brut.strip() and not propres:
        raise ValueError("Adresse en copie invalide.")
    return ", ".join(propres)


class EmailIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailIdentity
        fields = ["id", "department", "from_address", "signature"]
        extra_kwargs = {"smtp_password": {"write_only": True}}


class SentMailSerializer(serializers.ModelSerializer):
    auteur_email = serializers.CharField(source="auteur.email", read_only=True)

    class Meta:
        model = SentMail
        fields = ["id", "identity", "auteur", "auteur_email", "to", "cc", "subject", "body_html",
                  "client", "ticket", "project", "statut", "erreur", "cree_le"]
        read_only_fields = ["statut", "erreur", "auteur", "auteur_email"]


class MailSendView(APIView):
    """Envoi via l'identité du département de l'expéditeur (super_admin bypass)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != "super_admin" and not user.department_id:
            return Response({"detail": "Aucune identité mail pour votre profil."}, status=403)
        identity = EmailIdentity.objects.filter(
            department_id=None if user.role == "super_admin" else user.department_id
        ).first()
        if user.role == "super_admin":
            identity = EmailIdentity.objects.first()
        if not identity:
            return Response({"detail": "Identité mail du département non configurée."}, status=400)
        try:
            cc = normaliser_cc(request.data.get("cc"))
        except Exception:
            return Response({"cc": "Adresses en copie invalides (e-mails pro séparés par des virgules)."}, status=400)
        mail = SentMail.objects.create(
            identity=identity, auteur=user, to=request.data.get("to"), cc=cc,
            subject=request.data.get("subject", ""), body_html=request.data.get("body_html", ""),
            client_id=request.data.get("client"), ticket_id=request.data.get("ticket"),
            project_id=request.data.get("project"),
        )
        mail.expedier_async()  # Celery (eager en dev = synchrone)
        mail.refresh_from_db()
        return Response(SentMailSerializer(mail).data, status=201)


class SentMailViewSet(viewsets.ReadOnlyModelViewSet):
    """Historique : chacun ne voit que ses envois, super_admin voit tout."""

    queryset = SentMail.objects.select_related("identity", "auteur").all()
    serializer_class = SentMailSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "ticket", "project", "statut"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "super_admin":
            return qs
        if user.role == "client" and user.client_id:
            return qs.filter(client_id=user.client_id)
        return qs.filter(auteur=user)


class MailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailTemplate
        fields = ["id", "key", "nom", "subject", "body_html"]


class MailTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MailTemplate.objects.filter(actif=True)
    serializer_class = MailTemplateSerializer
    permission_classes = [IsAuthenticated]
