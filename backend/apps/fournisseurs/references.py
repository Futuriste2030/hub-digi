"""Références des documents d'achat — script serveur.

Génère des références uniques et séquentielles par type et par année :
  BDC-SLUG-2026-0001  (bon de commande)
  BDL-SLUG-2026-0001  (bon de livraison)
  ACHAT-SLUG-2026-0001 (facture fournisseur)
  RECU-F-SLUG-2026-0001 (reçu de paiement fournisseur)

Le compteur est incrémenté en transaction (ligne verrouillée) : pas de
doublon même en créations simultanées. Utilisé par les save() des modèles.
"""

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify


def generer_reference(prefixe, nom, date=None):
    """Retourne la prochaine référence pour (prefixe, année)."""
    from .models import CompteurReference

    date = date or timezone.localdate()
    annee = date.year
    slug = (slugify(nom or "") or "divers").upper()
    with transaction.atomic():
        compteur, _ = CompteurReference.objects.select_for_update().get_or_create(
            prefixe=prefixe, annee=annee, defaults={"dernier": 0})
        compteur.dernier += 1
        compteur.save(update_fields=["dernier"])
        seq = compteur.dernier
    return f"{prefixe}-{slug}-{annee}-{seq:04d}"
