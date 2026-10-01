from django.contrib import admin

from .models import (
    BonCommande,
    BonLivraison,
    FactureFournisseur,
    Fournisseur,
    PaiementFournisseur,
)


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ("nom_societe", "categorie", "statut")
    list_filter = ("statut", "categorie")
    search_fields = ("nom_societe", "email")


@admin.register(FactureFournisseur)
class FactureFournisseurAdmin(admin.ModelAdmin):
    list_display = ("numero", "fournisseur", "statut")


@admin.register(PaiementFournisseur)
class PaiementFournisseurAdmin(admin.ModelAdmin):
    list_display = ("numero", "facture", "montant", "moyen", "date")


@admin.register(BonCommande)
class BonCommandeAdmin(admin.ModelAdmin):
    list_display = ("numero", "fournisseur", "statut")
    list_filter = ("statut",)


@admin.register(BonLivraison)
class BonLivraisonAdmin(admin.ModelAdmin):
    list_display = ("numero", "fournisseur", "statut")
    list_filter = ("statut",)
