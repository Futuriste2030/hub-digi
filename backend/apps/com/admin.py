from django.contrib import admin

from .models import Campaign, Communique, Media, Publication


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("titre", "client", "canal", "statut")
    list_filter = ("statut", "canal")


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ("titre", "client", "canal", "statut", "date_pub")
    list_filter = ("statut", "canal")


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ("nom", "client", "type", "statut")
    list_filter = ("type", "statut")


@admin.register(Communique)
class CommuniqueAdmin(admin.ModelAdmin):
    list_display = ("titre", "client", "statut")
    list_filter = ("statut",)
