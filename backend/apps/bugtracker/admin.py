from django.contrib import admin

from .models import BugReport, ProjectTrackerKey


@admin.register(BugReport)
class BugReportAdmin(admin.ModelAdmin):
    list_display = ("numero", "project", "gravite", "statut", "cree_le")
    list_filter = ("gravite", "statut")
    search_fields = ("numero", "titre")


@admin.register(ProjectTrackerKey)
class ProjectTrackerKeyAdmin(admin.ModelAdmin):
    list_display = ("project", "public_key", "cree_le")
    search_fields = ("public_key",)
