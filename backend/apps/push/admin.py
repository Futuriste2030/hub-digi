from django.contrib import admin

from .models import PushSubscription, VapidConfig


@admin.register(VapidConfig)
class VapidConfigAdmin(admin.ModelAdmin):
    readonly_fields = ("cle_publique", "cree_le")
    exclude = ("cle_privee",)


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "endpoint", "cree_le")
    readonly_fields = ("user", "endpoint", "p256dh", "auth", "cree_le")
