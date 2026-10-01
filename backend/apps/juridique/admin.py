from django.contrib import admin

from .models import Contract, Dispute


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("titre", "type", "statut", "date_fin")
    list_filter = ("type", "statut")


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ("titre", "statut", "cree_le")
    list_filter = ("statut",)
