"""Envoi push en tâche Celery (eager = synchrone, jamais bloquant pour le métier)."""

import json

from celery import shared_task


@shared_task
def envoyer_push_async(notification_id):
    from pywebpush import WebPushException, webpush

    from apps.core.models import Notification

    from .models import PushSubscription, VapidConfig

    try:
        notif = Notification.objects.select_related("destinataire").get(id=notification_id)
    except Notification.DoesNotExist:
        return 0
    try:
        config = VapidConfig.instance()
    except Exception:
        return 0
    donnees = json.dumps({
        "title": notif.titre,
        "body": (notif.texte or "")[:150],
        "url": "/notifications/",
    })
    envoyes = 0
    for abo in PushSubscription.objects.filter(user=notif.destinataire):
        try:
            webpush(
                subscription_info={"endpoint": abo.endpoint,
                                   "keys": {"p256dh": abo.p256dh, "auth": abo.auth}},
                data=donnees,
                vapid_private_key=config.cle_privee,
                vapid_claims={"sub": "mailto:admin@digicom.ml"},
                # TTL 7 jours : le service push conserve le message si l'appareil est
                # hors-ligne (navigateur fermé) et le livre à la reconnexion.
                ttl=7 * 24 * 3600,
            )
            envoyes += 1
        except WebPushException as exc:
            # Abonnement expiré/révoqué côté navigateur : purger, jamais d'erreur métier.
            if getattr(exc, "response", None) is not None and exc.response.status_code in (404, 410):
                abo.delete()
        except Exception:
            pass
    return envoyes
