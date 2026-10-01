from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Campaign, Communique, Media, Publication


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = ["id", "client", "titre", "canal", "budget", "objectifs", "statut", "cree_le"]


class PublicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publication
        fields = ["id", "client", "campagne", "titre", "canal", "date_pub", "statut", "contenu", "a_valider_par_client"]


class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = ["id", "client", "nom", "type", "fichier", "url", "statut", "cree_le"]


class CommuniqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Communique
        fields = ["id", "titre", "client", "diffusion", "contenu", "statut", "cree_le"]


class ClientScopeMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(client_id=user.client_id)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs


class CampaignViewSet(ClientScopeMixin, viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "statut", "canal"]
    search_fields = ["titre"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_com"):
            return Response({"detail": "Suppression réservée au Chef Communication."}, status=403)
        obj = self.get_object()
        if obj.statut != "brouillon":
            return Response({"detail": "Seule une campagne brouillon peut être supprimée."}, status=400)
        return super().destroy(request, *args, **kwargs)


class PublicationViewSet(ClientScopeMixin, viewsets.ModelViewSet):
    queryset = Publication.objects.all()
    serializer_class = PublicationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "campagne", "statut", "canal"]
    search_fields = ["titre"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_com"):
            return Response({"detail": "Suppression réservée au Chef Communication."}, status=403)
        obj = self.get_object()
        if obj.statut not in ("brouillon", "a_valider"):
            return Response({"detail": "Seule une publication brouillon ou à valider peut être supprimée."}, status=400)
        return super().destroy(request, *args, **kwargs)


class MediaViewSet(ClientScopeMixin, viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "type", "statut"]
    search_fields = ["nom"]

    def destroy(self, request, *args, **kwargs):
        # com.medias_delete = chef_com / super_admin seuls (niveaux 3-6).
        if request.user.role not in ("super_admin", "chef_com"):
            return Response({"detail": "Suppression réservée au Chef Communication."}, status=403)
        media = self.get_object()
        if media.statut == "valide":
            return Response({"detail": "Média validé : suppression impossible, rejetez-le d'abord."}, status=400)
        if media.fichier:
            media.fichier.delete(save=False)
        return super().destroy(request, *args, **kwargs)


class CommuniqueViewSet(viewsets.ModelViewSet):
    queryset = Communique.objects.all()
    serializer_class = CommuniqueSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "statut"]
    search_fields = ["titre"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_com"):
            return Response({"detail": "Suppression réservée au Chef Communication."}, status=403)
        obj = self.get_object()
        if obj.statut != "brouillon":
            return Response({"detail": "Seul un communiqué brouillon peut être supprimé."}, status=400)
        return super().destroy(request, *args, **kwargs)
