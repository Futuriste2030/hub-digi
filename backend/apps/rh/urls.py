from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (CandidatureWebhookView, EmployeeViewSet, LeaveViewSet, PointageScanView,
                    PointageStatutView, PointageViewSet, PrimeViewSet, QRChallengeView,
                    RapportMensuelView, RapportPdfView, TentativeViewSet)
from .models import Candidature
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class CandidatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidature
        fields = ["id", "offre_reference", "offre_titre", "nom", "email", "telephone",
                  "message", "cv_url", "source", "statut", "cree_le"]
        # Le statut ne change que via statuer/ (transition contrôlée + mail candidat).
        read_only_fields = ["statut"]


# Réception -> examen -> entretien -> décision finale. Chaque transition notifie le candidat.
TRANSITIONS = {
    "recue": ("entretien", "rejetee"),
    "entretien": ("retenue", "rejetee"),
    "rejetee": ("recue",),
    "retenue": (),
}
TEMPLATE_PAR_DECISION = {
    "entretien": "candidature_entretien",
    "retenue": "candidature_retenue",
    "rejetee": "candidature_rejetee",
}


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

    @action(detail=True, methods=["post"])
    def statuer(self, request, pk=None):
        """Fait avancer le dossier : examen -> entretien -> décision, mail auto au candidat."""
        if request.user.role not in ("super_admin", "admin", "chef_rh"):
            return Response({"detail": "Décision réservée à la RH."}, status=403)
        cand = self.get_object()
        decision = (request.data.get("decision") or "").strip()
        message = (request.data.get("message") or "").strip()
        if decision not in ("entretien", "retenue", "rejetee"):
            return Response({"detail": "decision: entretien | retenue | rejetee."}, status=400)
        if decision not in TRANSITIONS.get(cand.statut, ()):
            return Response({"detail": f"Transition {cand.statut} -> {decision} impossible."}, status=400)
        if decision == "rejetee" and not message:
            return Response({"detail": "Motif du rejet obligatoire (envoyé au candidat)."}, status=400)
        cand.statut = decision
        cand.save(update_fields=["statut"])
        from apps.mailing.services import send_templated_mail

        send_templated_mail(
            TEMPLATE_PAR_DECISION[decision], cand.email,
            {"nom": cand.nom, "poste": cand.offre_titre or cand.offre_reference,
             "message": message or "—"},
            department_slug="rh",
        )
        return Response(CandidatureSerializer(cand).data)


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
