from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom_societe", "contact", "email", "statut")
    list_filter = ("statut",)
    search_fields = ("nom_societe", "contact", "email")
