"""Bug tracker — SPEC §9 : ProjectTrackerKey (clé publique) + BugReport (BUG-YYYY-####)."""

import secrets

from django.db import models
from django.utils import timezone


def numero_bug():
    annee = timezone.now().year
    dernier = BugReport.objects.filter(numero__startswith=f"BUG-{annee}-").order_by("-numero").first()
    seq = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
    return f"BUG-{annee}-{seq:04d}"


class ProjectTrackerKey(models.Model):
    project = models.OneToOneField("projects_dev.Project", on_delete=models.CASCADE, related_name="tracker_key")
    public_key = models.CharField(max_length=64, unique=True, blank=True)
    allowed_origins = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.public_key:
            self.public_key = "digi_pub_" + secrets.token_hex(16)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.project} ({self.public_key})"


class BugReport(models.Model):
    GRAVITES = [("basse", "Basse"), ("moyenne", "Moyenne"), ("haute", "Haute"), ("critique", "Critique")]
    STATUTS = [("nouveau", "Nouveau"), ("confirme", "Confirmé"), ("en_cours", "En cours"),
               ("corrige", "Corrigé"), ("rejete", "Rejeté")]

    numero = models.CharField(max_length=20, unique=True, blank=True)
    project = models.ForeignKey("projects_dev.Project", on_delete=models.CASCADE, related_name="bugs")
    titre = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    gravite = models.CharField(max_length=20, choices=GRAVITES, default="moyenne")
    statut = models.CharField(max_length=20, choices=STATUTS, default="nouveau")
    assigne = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    tache = models.ForeignKey("projects_dev.Task", null=True, blank=True, on_delete=models.SET_NULL)
    meta = models.JSONField(default=dict, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Bug {self.id}"

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = numero_bug()
        super().save(*args, **kwargs)
