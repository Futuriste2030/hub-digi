"""Biométrie / passkeys (WebAuthn) — optionnel, additif au mot de passe.

La biométrie ne quitte jamais l'appareil : le serveur ne stocke que la clé
publique + compteur de signature. Le login mdp reste toujours disponible.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class PasskeyCredential(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="passkeys")
    credential_id = models.CharField(max_length=255, unique=True)
    cle_publique = models.TextField()  # base64url
    compteur_signature = models.IntegerField(default=0)
    nom = models.CharField(max_length=100, default="Mon appareil")
    cree_le = models.DateTimeField(auto_now_add=True)
    dernier_usage = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-dernier_usage", "-cree_le"]

    def __str__(self):
        return f"passkey {self.nom} ({self.user})"


class PasskeyChallenge(models.Model):
    """Défis à usage unique, 10 min max — robuste multi-workers gunicorn
    (pas de session, l'API est stateless JWT)."""

    REGISTRATION = "reg"
    AUTHENTICATION = "auth"
    USAGES = [(REGISTRATION, "Enregistrement"), (AUTHENTICATION, "Authentification")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.CASCADE, related_name="passkey_challenges")
    email = models.CharField(max_length=255, blank=True)
    challenge = models.CharField(max_length=255, unique=True)
    usage = models.CharField(max_length=10, choices=USAGES)
    utilise = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    DUREE_MINUTES = 10

    @classmethod
    def consommer(cls, challenge_b64, usage):
        from webauthn.helpers import base64url_to_bytes

        try:
            defi = cls.objects.get(challenge=challenge_b64, usage=usage, utilise=False)
        except cls.DoesNotExist:
            return None
        if (timezone.now() - defi.cree_le).total_seconds() > cls.DUREE_MINUTES * 60:
            defi.delete()
            return None
        defi.utilise = True
        defi.save()
        cls.objects.filter(cree_le__lt=timezone.now() - timezone.timedelta(minutes=cls.DUREE_MINUTES)).delete()
        return base64url_to_bytes(challenge_b64)
