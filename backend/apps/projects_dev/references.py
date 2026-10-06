"""References Taches — TASK-AAAA-NNNN.

Reutilise le compteur atomique existant (apps.fournisseurs.CompteurReference,
prefixe + annee) : pas de doublon meme en creations simultanees.
Format volontairement sans slug (SPEC Jira §1) : TASK-2026-0042.
"""

from django.db import transaction
from django.utils import timezone


def generer_reference_task(date=None):
    """Retourne la prochaine reference TASK-AAAA-NNNN."""
    from apps.fournisseurs.models import CompteurReference

    date = date or timezone.localdate()
    annee = date.year
    with transaction.atomic():
        compteur, _ = CompteurReference.objects.select_for_update().get_or_create(
            prefixe="TASK", annee=annee, defaults={"dernier": 0})
        compteur.dernier += 1
        compteur.save(update_fields=["dernier"])
        seq = compteur.dernier
    return f"TASK-{annee}-{seq:04d}"
