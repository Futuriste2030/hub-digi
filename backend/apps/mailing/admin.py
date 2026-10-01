from django.contrib import admin

from .models import EmailIdentity, MailTemplate, SentMail


@admin.register(EmailIdentity)
class EmailIdentityAdmin(admin.ModelAdmin):
    list_display = ("department", "from_address")


@admin.register(MailTemplate)
class MailTemplateAdmin(admin.ModelAdmin):
    list_display = ("key", "nom", "actif")
    list_filter = ("actif",)


@admin.register(SentMail)
class SentMailAdmin(admin.ModelAdmin):
    list_display = ("to", "subject", "statut", "cree_le")
    list_filter = ("statut",)
