"""Formations — soumissions du site vitrine -> participants + inscriptions + factures.

Pas de `clients.Client` : les stagiaires vivent dans `ParticipantFormation`
(propre à cette app). Chaque inscription crée sa `Invoice` (client NULL,
inscription liée) en statut brouillon ; le clic WhatsApp la passe en envoyée.
"""

from django.db import models
from django.utils import timezone


class Formation(models.Model):
    slug = models.SlugField(max_length=200, unique=True, help_text="Clé stable partagée avec le site vitrine")
    titre = models.CharField(max_length=200)
    prix = models.PositiveIntegerField(default=0, help_text="Prix en F CFA (XOF)")
    duree = models.CharField(max_length=100, blank=True)
    active = models.BooleanField(default=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["titre"]

    def __str__(self):
        return f"{self.titre} — {self.prix} F"


class ParticipantFormation(models.Model):
    """Client d'une formation (pas un `clients.Client`, pas de portail /espace)."""

    full_name = models.CharField(max_length=200)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=50, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"{self.full_name} ({self.email})"


class InscriptionFormation(models.Model):
    STATUT_RECUE = "recue"
    STATUT_CONFIRMEE = "confirmee"
    STATUT_ANNULEE = "annulee"
    STATUTS = [
        (STATUT_RECUE, "Reçue"),
        (STATUT_CONFIRMEE, "Confirmée"),
        (STATUT_ANNULEE, "Annulée"),
    ]

    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name="inscriptions")
    participant = models.ForeignKey(ParticipantFormation, on_delete=models.CASCADE, related_name="inscriptions")
    reference = models.CharField(max_length=80, unique=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_RECUE)
    message = models.TextField(blank=True)
    reference_site = models.CharField(max_length=200, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.reference or f"Inscription {self.pk}"

    def save(self, *args, **kwargs):
        nouveau = self.pk is None and not self.reference
        super().save(*args, **kwargs)
        if nouveau:
            annee = timezone.localdate(self.cree_le).year if self.cree_le else timezone.localdate().year
            self.reference = f"INS-{annee}-{self.pk:04d}"
            super().save(update_fields=["reference"])
