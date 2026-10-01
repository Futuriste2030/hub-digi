"""RH API — SPEC §5.5/§12 : employees/leaves/validate + webhook candidatures (WEBHOOK-CARRIERE.md)."""

from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Candidature, Employee, Leave


class EmployeeSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "user", "email", "fonction", "date_embauche", "solde_conges", "en_conge"]


class LeaveSerializer(serializers.ModelSerializer):
    duree = serializers.ReadOnlyField()

    class Meta:
        model = Leave
        fields = ["id", "employe", "du_jour", "au_jour", "motif", "statut", "valideur",
                  "commentaire", "duree", "cree_le"]
        read_only_fields = ["statut", "valideur"]


class CandidatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidature
        fields = ["id", "offre_reference", "offre_titre", "nom", "email", "telephone",
                  "message", "cv_url", "source", "statut", "cree_le"]


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["user__email", "fonction"]


class LeaveViewSet(viewsets.ModelViewSet):
    queryset = Leave.objects.select_related("employe").all()
    serializer_class = LeaveSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["employe", "statut"]

    @action(detail=True, methods=["patch"])
    def validate(self, request, pk=None):
        """RH/admin valide ou refuse (SPEC §5.5.2)."""
        conge = self.get_object()
        if request.user.role not in ("super_admin", "admin", "chef_rh"):
            return Response({"detail": "Réservé RH/admin."}, status=403)
        decision = request.data.get("decision")
        if decision not in ("valide", "refuse"):
            return Response({"detail": "decision: valide | refuse."}, status=400)
        if decision == "refuse" and not request.data.get("commentaire"):
            return Response({"detail": "Commentaire obligatoire en cas de refus."}, status=400)
        conge.statut = Leave.STATUT_VALIDE if decision == "valide" else Leave.STATUT_REFUSE
        conge.valideur = request.user
        conge.commentaire = request.data.get("commentaire", "")
        if decision == "valide":
            conge.employe.solde_conges = max(0, float(conge.employe.solde_conges) - conge.duree)
            conge.employe.save()
        conge.save()
        return Response(LeaveSerializer(conge).data)


class CandidatureWebhookView(APIView):
    """Webhook site vitrine -> HUB (public, token X-Hub-Token, throttle 60/min)."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def post(self, request):
        token = request.headers.get("X-Hub-Token", "")
        if not settings.CAREER_WEBHOOK_TOKEN or not constant_time_compare(token, settings.CAREER_WEBHOOK_TOKEN):
            return Response({"detail": "refusé"}, status=403)
        email = request.data.get("email", "")
        offre_ref = request.data.get("offre_reference", "")
        if not email or "@" not in email or not request.data.get("nom"):
            return Response({"detail": "nom + email valides requis."}, status=400)
        cand, created = Candidature.objects.get_or_create(
            email=email, offre_reference=offre_ref,
            defaults={
                "offre_titre": request.data.get("offre_titre", ""),
                "nom": request.data.get("nom", ""),
                "telephone": request.data.get("telephone", ""),
                "message": request.data.get("message", ""),
                "cv_url": request.data.get("cv_url") or "",
                "source": "site",
            },
        )
        status = 201 if created else 200
        return Response({"id": cand.id, "statut": "Reçue" if created else "doublon"}, status=status)
