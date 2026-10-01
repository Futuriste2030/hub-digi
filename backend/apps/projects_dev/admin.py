from django.contrib import admin

from .models import Milestone, Project, Task


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("titre", "client", "type", "statut", "deadline")
    list_filter = ("type", "statut")
    search_fields = ("titre", "client__nom_societe")
    inlines = [MilestoneInline, TaskInline]


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("titre", "project", "statut", "assigne", "temps_passe")
    list_filter = ("statut", "project")
    search_fields = ("titre",)


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ("titre", "project", "date", "statut")
    list_filter = ("statut",)
