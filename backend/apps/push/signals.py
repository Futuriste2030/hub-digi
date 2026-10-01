"""Relais push : toute Notification créée (bug, ticket, congé, mail…) est aussi
poussée vers les navigateurs abonnés — sans toucher au code métier existant."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.core.models import Notification


@receiver(post_save, sender=Notification)
def relayer_notification_push(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        from .tasks import envoyer_push_async

        envoyer_push_async.delay(instance.id)
    except Exception:
        pass
