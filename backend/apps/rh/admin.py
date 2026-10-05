from django.contrib import admin

from .models import (Candidature, Employee, Leave, Pointage, Prime, QRToken, SitePointage,
                     TentativePointage)


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


@admin.register(SitePointage)
class SitePointageAdmin(admin.ModelAdmin):
    list_display = ("nom", "heure_arrivee", "heure_depart", "rayon_m", "actif")


@admin.register(Pointage)
class PointageAdmin(admin.ModelAdmin):
    list_display = ("employe", "date", "heure_arrivee", "statut_arrivee",
                    "heure_depart", "statut_depart", "distance_m")
    list_filter = ("date", "statut_arrivee", "statut_depart")
    readonly_fields = ("employe", "date", "heure_arrivee", "statut_arrivee",
                       "heure_depart", "statut_depart", "latitude", "longitude",
                       "distance_m", "cree_le")

    def has_add_permission(self, request):
        return False


@admin.register(QRToken)
class QRTokenAdmin(admin.ModelAdmin):
    list_display = ("employe", "expire_le", "utilise", "cree_le")
    list_filter = ("utilise",)
    readonly_fields = ("employe", "nonce", "expire_le", "utilise", "cree_le")

    def has_add_permission(self, request):
        return False


@admin.register(Prime)
class PrimeAdmin(admin.ModelAdmin):
    list_display = ("employe", "mois", "montant", "validee")
    list_filter = ("mois", "validee")


@admin.register(TentativePointage)
class TentativePointageAdmin(admin.ModelAdmin):
    list_display = ("employe", "date", "type", "distance_m", "statut", "cree_le")
    list_filter = ("statut", "type", "date")
    readonly_fields = ("employe", "date", "type", "latitude", "longitude", "distance_m",
                       "statut", "valideur", "cree_le")

    def has_add_permission(self, request):
        return False
