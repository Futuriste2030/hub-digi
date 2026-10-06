from django.contrib import admin

from .models import LienGit, LivraisonWebhook, Milestone, Project, Sprint, Task


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0


class SprintInline(admin.TabularInline):
    model = Sprint
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("titre", "client", "type", "statut", "deadline", "github_repo", "github_auto_statut")
    list_filter = ("type", "statut")
    search_fields = ("titre", "client__nom_societe", "github_repo")
    inlines = [MilestoneInline, SprintInline, TaskInline]
    exclude = ("github_webhook_secret",)  # secret jamais affiché (régénération via API).


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("reference", "titre", "project", "statut", "priorite", "assigne", "temps_passe", "sprint")
    list_filter = ("statut", "priorite", "project")
    search_fields = ("titre", "reference")


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ("titre", "project", "date", "statut")
    list_filter = ("statut",)


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ("nom", "project", "statut", "date_debut", "date_fin", "points_engages", "points_termines")
    list_filter = ("statut", "project")


@admin.register(LienGit)
class LienGitAdmin(admin.ModelAdmin):
    list_display = ("task", "bug", "type", "identifiant_externe", "statut_pr", "created_at")
    list_filter = ("type", "statut_pr")
    search_fields = ("identifiant_externe", "titre")


@admin.register(LivraisonWebhook)
class LivraisonWebhookAdmin(admin.ModelAdmin):
    list_display = ("delivery_id", "event", "project", "statut_traitement", "created_at")
    list_filter = ("event", "statut_traitement")
    readonly_fields = ("delivery_id", "event", "project", "statut_traitement", "erreur", "created_at")
