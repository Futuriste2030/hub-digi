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

    class Meta:
        model = Contract
        fields = ["id", "titre", "type", "client", "client_nom", "employe", "employe_email",
                  "fichier", "contenu", "date_fin", "statut", "jours_restants", "cree_le"]


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
