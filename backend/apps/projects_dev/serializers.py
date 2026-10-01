from rest_framework import permissions, serializers

from .models import Milestone, Project, Task


class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = ["id", "project", "titre", "date", "statut"]


class TaskSerializer(serializers.ModelSerializer):
    assigne_email = serializers.CharField(source="assigne.email", read_only=True)

    class Meta:
        model = Task
        fields = ["id", "project", "titre", "statut", "assigne", "assigne_email", "temps_passe", "cree_le", "maj_le"]
        read_only_fields = ["id", "cree_le", "maj_le"]


class ProjectSerializer(serializers.ModelSerializer):
    progression = serializers.ReadOnlyField()
    client_nom = serializers.CharField(source="client.nom_societe", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "client", "client_nom", "titre", "type", "statut", "deadline",
            "progression", "repo_url", "notes_deploiement", "cree_le", "maj_le",
        ]
        read_only_fields = ["id", "progression", "cree_le", "maj_le"]


class IsChefDev(permissions.BasePermission):
    """Écriture projets : super_admin + chef_dev. Lecture : tout interne + client (son scope)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role in ("super_admin", "chef_dev")
