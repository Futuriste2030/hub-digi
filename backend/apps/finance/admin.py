from django.contrib import admin

from .models import (
    Devis,
    DevisLigne,
    Expense,
    FichePaie,
    Invoice,
    InvoiceLigne,
    LignePaie,
    Receipt,
)


@admin.register(Devis)
class DevisAdmin(admin.ModelAdmin):
    list_display = ("id", "objet", "client", "statut")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("numero", "client", "statut")


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("numero", "invoice", "montant", "moyen")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("libelle", "departement", "montant", "date")


@admin.register(DevisLigne)
class DevisLigneAdmin(admin.ModelAdmin):
    list_display = ("devis", "description", "quantite", "montant")


@admin.register(InvoiceLigne)
class InvoiceLigneAdmin(admin.ModelAdmin):
    list_display = ("invoice", "description", "quantite", "montant")


@admin.register(FichePaie)
class FichePaieAdmin(admin.ModelAdmin):
    list_display = ("mois_idx", "annee", "statut")
    list_filter = ("annee", "statut")


@admin.register(LignePaie)
class LignePaieAdmin(admin.ModelAdmin):
    list_display = ("numero", "fiche", "nom", "montant", "statut")
