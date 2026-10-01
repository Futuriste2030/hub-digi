"""Push web — couche parallèle aux notifs in-app (SPEC §10) : VAPID + abonnements.

Logique existante inchangée : un signal post_save sur Notification relaie
vers le push. Pas de VAPID en .env : clés auto-générées et persistées en base
(singleton, volume /data en prod) au premier appel.
"""

import base64

from django.conf import settings
from django.db import models


def _b64url_nopad(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def generer_cles_vapid():
    """Paire VAPID P-256 (privée base64url pour pywebpush, publique pour le front)."""
    from cryptography.hazmat.primitives.asymmetric import ec

    cle = ec.generate_private_key(ec.SECP256R1())
    privee = cle.private_numbers().private_value.to_bytes(32, "big")
    nums = cle.public_key().public_numbers()
    publique = b"\x04" + nums.x.to_bytes(32, "big") + nums.y.to_bytes(32, "big")
    return _b64url_nopad(privee), _b64url_nopad(publique)


class VapidConfig(models.Model):
    cle_publique = models.TextField()
    cle_privee = models.TextField()
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Configuration VAPID"

    @classmethod
    def instance(cls):
        obj, cree = cls.objects.get_or_create(id=1, defaults=dict(zip(
            ("cle_privee", "cle_publique"), generer_cles_vapid())))
        if cree or not obj.cle_publique or not obj.cle_privee:
            privee, publique = generer_cles_vapid()
            obj.cle_privee, obj.cle_publique = privee, publique
            obj.save()
        return obj


class PushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="push_subscriptions")
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"push {self.user} ({self.endpoint[:40]}…)"
