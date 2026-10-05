from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (CandidatureWebhookView, EmployeeViewSet, LeaveViewSet, PointageScanView,
                    PointageStatutView, PointageViewSet, PrimeViewSet, QRChallengeView,
                    RapportMensuelView, RapportPdfView, TentativeViewSet)
from .models import Candidature
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class CandidatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidature
        fields = ["id", "offre_reference", "offre_titre", "nom", "email", "telephone",
                  "message", "cv_url", "source", "statut", "cree_le"]


class CandidatureViewSet(viewsets.ModelViewSet):
    queryset = Candidature.objects.all()
    serializer_class = CandidatureSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["statut", "source", "offre_reference"]
    search_fields = ["nom", "email"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "admin", "chef_rh"):
            return Response({"detail": "Suppression réservée à la RH."}, status=403)
        obj = self.get_object()
        if obj.statut not in ("recue", "rejetee"):
            return Response({"detail": "Seule une candidature reçue ou rejetée peut être supprimée."}, status=400)
        return super().destroy(request, *args, **kwargs)


router = DefaultRouter()
router.register("rh/employees", EmployeeViewSet, basename="employee")
router.register("rh/leaves", LeaveViewSet, basename="leave")
router.register("rh/recruitments", CandidatureViewSet, basename="candidature")
router.register("rh/pointages", PointageViewSet, basename="pointage")
router.register("rh/primes", PrimeViewSet, basename="prime")
router.register("rh/tentatives", TentativeViewSet, basename="tentative")

urlpatterns = [
    path("rh/candidatures/", CandidatureWebhookView.as_view(), name="candidature-webhook"),
    path("rh/pointage/statut/", PointageStatutView.as_view(), name="pointage-statut"),
    path("rh/pointage/qr/", QRChallengeView.as_view(), name="pointage-qr"),
    path("rh/pointage/scan/", PointageScanView.as_view(), name="pointage-scan"),
    path("rh/pointage/rapport/", RapportMensuelView.as_view(), name="pointage-rapport"),
    path("rh/pointage/rapport/pdf/", RapportPdfView.as_view(), name="pointage-rapport-pdf"),
] + router.urls
