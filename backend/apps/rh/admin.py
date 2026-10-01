from django.contrib import admin

from .models import Candidature, Employee, Leave


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "fonction", "solde_conges", "en_conge")
    list_filter = ("en_conge",)


@admin.register(Leave)
class LeaveAdmin(admin.ModelAdmin):
    list_display = ("employe", "du_jour", "au_jour", "statut")
    list_filter = ("statut",)


@admin.register(Candidature)
class CandidatureAdmin(admin.ModelAdmin):
    list_display = ("nom", "email", "offre_titre", "source", "statut")
    list_filter = ("source", "statut")
    search_fields = ("nom", "email")
