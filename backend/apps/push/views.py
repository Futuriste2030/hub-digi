"""Endpoints push : clé VAPID publique, abonnement/désabonnement, test.

Le test crée une vraie Notification au destinataire connecté : elle apparaît
dans la cloche ET part en push — même tuyau que bugs/tickets/mails.
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import Notification

from .models import PushSubscription, VapidConfig


class VapidPublicKeyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            config = VapidConfig.instance()
            return Response({"publicKey": config.cle_publique})
        except Exception:
            return Response({"detail": "Push indisponible."}, status=503)


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = (request.data.get("endpoint") or "").strip()
        cles = request.data.get("keys") or {}
        p256dh = (cles.get("p256dh") or "").strip()
        auth = (cles.get("auth") or "").strip()
        if not endpoint.startswith("https://") or not p256dh or not auth:
            return Response({"detail": "Abonnement invalide."}, status=400)
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
        )
        return Response({"detail": "Notifications push activées."}, status=201)

    def delete(self, request):
        endpoint = (request.data.get("endpoint") or "").strip()
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=204)


class PushTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        notif = Notification.objects.create(
            destinataire=request.user,
            titre="Test push HUB DIGI",
            texte="Si vous lisez ceci hors du hub, les notifications push fonctionnent.",
        )
        return Response({"detail": "Notification de test créée.", "id": notif.id}, status=201)
