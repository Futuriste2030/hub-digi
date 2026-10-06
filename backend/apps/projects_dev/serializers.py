from rest_framework import permissions, serializers

from .models import LienGit, LivraisonWebhook, Milestone, Project, Sprint, Task


class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = ["id", "project", "titre", "date", "statut"]


class TaskSerializer(serializers.ModelSerializer):
    assigne_email = serializers.CharField(source="assigne.email", read_only=True)
    ajoutee_en_cours_de_sprint = serializers.ReadOnlyField()

    class Meta:
        model = Task
        fields = [
            "id", "reference", "project", "titre", "statut", "assigne", "assigne_email",
            "temps_passe", "estimation_points", "estimation_heures", "priorite", "done_at",
            "sprint", "sprint_added_at", "ajoutee_en_cours_de_sprint", "cree_le", "maj_le",
        ]
        read_only_fields = ["id", "reference", "done_at", "sprint_added_at",
                            "ajoutee_en_cours_de_sprint", "cree_le", "maj_le"]

    def validate_estimation_points(self, v):
        if v is not None and v <= 0:
            raise serializers.ValidationError("Points positifs requis (ex. 1, 2, 3, 5, 8, 13).")
        return v

    def validate_estimation_heures(self, v):
        if v is not None and v < 0:
            raise serializers.ValidationError("Heures positives requises.")
        return v


class SprintSerializer(serializers.ModelSerializer):
    taches_total = serializers.SerializerMethodField()
    taches_terminees = serializers.SerializerMethodField()

    class Meta:
        model = Sprint
        fields = [
            "id", "project", "nom", "objectif", "date_debut", "date_fin", "statut",
            "points_engages", "points_termines", "demarre_le", "termine_le",
            "taches_total", "taches_terminees", "cree_le", "maj_le",
        ]
        read_only_fields = ["id", "points_engages", "points_termines", "demarre_le",
                            "termine_le", "taches_total", "taches_terminees", "cree_le", "maj_le"]

    def get_taches_total(self, obj):
        return obj.taches.count()

    def get_taches_terminees(self, obj):
        return obj.taches.filter(statut=Task.STATUT_DONE).count()


class LienGitSerializer(serializers.ModelSerializer):
    class Meta:
        model = LienGit
        fields = ["id", "task", "bug", "type", "identifiant_externe", "url", "titre",
                  "auteur_github", "statut_pr", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class LivraisonWebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = LivraisonWebhook
        fields = ["id", "delivery_id", "event", "project", "statut_traitement", "erreur", "created_at"]
        read_only_fields = fields


class ProjectSerializer(serializers.ModelSerializer):
    progression = serializers.ReadOnlyField()
    client_nom = serializers.CharField(source="client.nom_societe", read_only=True)
    sprint_actif = serializers.SerializerMethodField()
    # Secret jamais renvoyé en liste/détail (§4.3) : affiché une seule fois à la (re)génération
    # (aucun champ secret ici ; la régénération le renvoie dans sa propre réponse).

    class Meta:
        model = Project
        fields = [
            "id", "client", "client_nom", "titre", "type", "statut", "deadline",
            "progression", "repo_url", "notes_deploiement",
            "github_repo", "github_auto_statut", "sprint_actif",
            "cree_le", "maj_le",
        ]
        read_only_fields = ["id", "progression", "client_nom", "sprint_actif", "cree_le", "maj_le"]

    def get_sprint_actif(self, obj):
        sprint = obj.sprints.filter(statut=Sprint.STATUT_ACTIF).first()
        return SprintSerializer(sprint).data if sprint else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return data


class IsChefDev(permissions.BasePermission):
    """Écriture projets : super_admin + chef_dev. Lecture : tout interne + client (son scope)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role in ("super_admin", "chef_dev")


def est_chef_dev(user):
    return getattr(user, "role", None) in ("super_admin", "chef_dev")


# Champs que membre_dev peut modifier sur ses tâches (exécution) : déplacement + temps passé.
CHAMPS_MEMBRE_DEV = {"statut", "temps_passe"}
# Champs réservés chef_dev/super_admin (crayons réservés) : estimation, priorité, sprint.
CHAMPS_CHEF_DEV = {"estimation_points", "estimation_heures", "priorite", "sprint"}
