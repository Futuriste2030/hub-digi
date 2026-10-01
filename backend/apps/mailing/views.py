"""Mailing API — SPEC §8/§12 : /mailing/send/ + /mailing/sent/."""

from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailIdentity, MailTemplate, SentMail


class EmailIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailIdentity
        fields = ["id", "department", "from_address", "signature"]
        extra_kwargs = {"smtp_password": {"write_only": True}}


class SentMailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SentMail
        fields = ["id", "identity", "to", "subject", "body_html", "client", "ticket",
                  "project", "statut", "erreur", "cree_le"]
        read_only_fields = ["statut", "erreur"]


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
        mail = SentMail.objects.create(
            identity=identity, to=request.data.get("to"), subject=request.data.get("subject", ""),
            body_html=request.data.get("body_html", ""), client_id=request.data.get("client"),
            ticket_id=request.data.get("ticket"), project_id=request.data.get("project"),
        )
        mail.expedier_async()  # Celery (eager en dev = synchrone)
        mail.refresh_from_db()
        return Response(SentMailSerializer(mail).data, status=201)


class SentMailViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SentMail.objects.select_related("identity").all()
    serializer_class = SentMailSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "ticket", "project", "statut"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(client_id=user.client_id)
        return qs


class MailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailTemplate
        fields = ["id", "key", "nom", "subject", "body_html"]


class MailTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MailTemplate.objects.filter(actif=True)
    serializer_class = MailTemplateSerializer
    permission_classes = [IsAuthenticated]
