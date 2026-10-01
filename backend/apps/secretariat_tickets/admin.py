from django.contrib import admin

from .models import (
    Courrier,
    Decharge,
    DecisionReunion,
    Reunion,
    Ticket,
    TicketApproval,
    TicketMessage,
)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("numero", "sujet", "statut", "priorite", "cree_le")
    list_filter = ("statut", "priorite")
    search_fields = ("numero", "sujet")


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "auteur", "is_internal", "cree_le")
    list_filter = ("is_internal",)


@admin.register(TicketApproval)
class TicketApprovalAdmin(admin.ModelAdmin):
    list_display = ("ticket", "demandeur", "valideur", "decision")
    list_filter = ("decision",)


@admin.register(Decharge)
class DechargeAdmin(admin.ModelAdmin):
    list_display = ("reference", "provenance", "objet", "date_recue", "poids_ko")
    search_fields = ("reference", "provenance", "objet")


@admin.register(Courrier)
class CourrierAdmin(admin.ModelAdmin):
    list_display = ("reference", "sens", "objet", "statut", "date")
    list_filter = ("sens", "statut")
    search_fields = ("reference", "objet")


@admin.register(Reunion)
class ReunionAdmin(admin.ModelAdmin):
    list_display = ("titre", "date", "statut")
    list_filter = ("statut",)


@admin.register(DecisionReunion)
class DecisionReunionAdmin(admin.ModelAdmin):
    list_display = ("reunion", "responsable", "echeance")
