from django.contrib import admin

from .models import AuditLog, DirectMessage, GroupeChat, Notification, SiteSettings


class LectureSeuleAdmin(admin.ModelAdmin):
    """Tables de traçabilité : consultation + purge, pas de création ni modification."""

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(AuditLog)
class AuditLogAdmin(LectureSeuleAdmin):
    list_display = ("cree_le", "user", "action", "objet")
    list_filter = ("action",)
    search_fields = ("objet",)


@admin.register(Notification)
class NotificationAdmin(LectureSeuleAdmin):
    list_display = ("titre", "destinataire", "lue", "cree_le")
    list_filter = ("lue",)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("raison", "email", "phone")


@admin.register(GroupeChat)
class GroupeChatAdmin(admin.ModelAdmin):
    list_display = ("nom", "general", "cree_le")
    list_filter = ("general",)


@admin.register(DirectMessage)
class DirectMessageAdmin(LectureSeuleAdmin):
    list_display = ("expediteur", "destinataire", "groupe", "lu", "cree_le")
    list_filter = ("lu",)
