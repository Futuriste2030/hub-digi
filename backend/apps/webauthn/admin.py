from django.contrib import admin

from .models import PasskeyChallenge, PasskeyCredential


@admin.register(PasskeyCredential)
class PasskeyCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "nom", "dernier_usage", "cree_le")
    readonly_fields = ("user", "credential_id", "cle_publique", "compteur_signature", "cree_le", "dernier_usage")


@admin.register(PasskeyChallenge)
class PasskeyChallengeAdmin(admin.ModelAdmin):
    list_display = ("email", "usage", "utilise", "cree_le")
    readonly_fields = ("user", "email", "challenge", "usage", "utilise", "cree_le")
