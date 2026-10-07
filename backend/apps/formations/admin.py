from django.contrib import admin

from .models import Formation, InscriptionFormation, ParticipantFormation


@admin.register(Formation)
class FormationAdmin(admin.ModelAdmin):
    list_display = ["slug", "titre", "prix", "duree", "active"]
    list_editable = ["prix", "active"]
    list_filter = ["active"]
    search_fields = ["slug", "titre"]


@admin.register(ParticipantFormation)
class ParticipantFormationAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "phone", "cree_le"]
    search_fields = ["full_name", "email", "phone"]


@admin.register(InscriptionFormation)
class InscriptionFormationAdmin(admin.ModelAdmin):
    list_display = ["reference", "formation", "participant", "statut", "cree_le"]
    list_filter = ["formation", "statut"]
    search_fields = ["reference", "participant__full_name", "participant__email"]
    readonly_fields = ["reference", "cree_le"]
