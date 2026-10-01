from django.http import FileResponse
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Contract, Dispute
from .pdf import pdf_contrat


class ContractSerializer(serializers.ModelSerializer):
    jours_restants = serializers.ReadOnlyField()
    employe_email = serializers.CharField(source="employe.user.email", read_only=True)
    client_nom = serializers.CharField(source="client.nom_societe", read_only=True)
    signe_employe = serializers.BooleanField(source="est_signe_employe", read_only=True)

    class Meta:
        model = Contract
        fields = ["id", "titre", "type", "client", "client_nom", "employe", "employe_email",
                  "fichier", "contenu", "date_fin", "statut", "jours_restants",
                  "signe_employe", "signature_employe_nom", "signature_employe_le",
                  "cree_le"]
        read_only_fields = ["signature_employe_nom", "signature_employe_le"]


class DisputeSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_societe", read_only=True)

    class Meta:
        model = Dispute
        fields = ["id", "titre", "client", "client_nom", "partie", "statut", "description", "cree_le"]


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.select_related("client", "employe__user").all()
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["type", "statut", "client", "employe"]
    search_fields = ["titre"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        contrat = self.get_object()
        return FileResponse(pdf_contrat(contrat), as_attachment=True,
                            filename=f"contrat-{contrat.pk}.pdf")

    @action(detail=False, methods=["get"])
    def mes(self, request):
        """Contrats de travail de l'employé connecté (Mon espace / Profil)."""
        contrats = self.get_queryset().filter(employe__user=request.user, type="employe")
        return Response(self.get_serializer(contrats, many=True).data)

    @action(detail=True, methods=["post"])
    def signer(self, request, pk=None):
        """Signature électronique du salarié : lui seul, nom + case « Lu et approuvé »."""
        from django.utils import timezone

        contrat = self.get_object()
        if contrat.type != "employe" or not contrat.employe_id:
            return Response({"detail": "Signature réservée aux contrats de travail."}, status=400)
        if not contrat.employe.user_id or contrat.employe.user_id != request.user.id:
            return Response({"detail": "Seul le salarié concerné peut signer."}, status=403)
        if contrat.est_signe_employe:
            return Response({"detail": "Contrat déjà signé."}, status=400)
        nom = (request.data.get("nom") or "").strip()
        if not request.data.get("lu_approuve") or len(nom) < 3:
            return Response({"detail": "Saisissez votre nom et cochez « Lu et approuvé »."}, status=400)
        contrat.signature_employe_nom = nom
        contrat.signature_employe_le = timezone.now()
        contrat.signature_employe_hash = contrat.empreinte_signature()
        contrat.save()
        try:
            from apps.accounts.models import User
            from apps.core.models import Notification

            for u in User.objects.filter(role__in=["super_admin", "chef_juridique"], is_active=True):
                Notification.objects.create(
                    destinataire=u, titre=f"Contrat signé — {contrat.titre}",
                    texte=f"{nom} a signé électroniquement le {contrat.signature_employe_le:%d/%m/%Y}.")
        except Exception:
            pass
        return Response({"detail": "Contrat signé électroniquement."})

    def perform_update(self, serializer):
        contrat = self.get_object()
        modifie = any(f in (serializer.validated_data or {}) for f in ("titre", "contenu"))
        if modifie and contrat.est_signe_employe:
            serializer.validated_data["signature_employe_nom"] = ""
            serializer.validated_data["signature_employe_le"] = None
            serializer.validated_data["signature_employe_hash"] = ""
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_juridique"):
            return Response({"detail": "Suppression réservée au Chef Juridique."}, status=403)
        obj = self.get_object()
        if obj.statut != "brouillon":
            return Response({"detail": "Seul un contrat brouillon peut être supprimé."}, status=400)
        if obj.fichier:
            obj.fichier.delete(save=False)
        return super().destroy(request, *args, **kwargs)


class DisputeViewSet(viewsets.ModelViewSet):
    queryset = Dispute.objects.all()
    serializer_class = DisputeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["statut", "client"]
    search_fields = ["titre"]
