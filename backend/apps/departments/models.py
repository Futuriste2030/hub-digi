"""Départements & Postes — SPEC §3 : Poste rattaché à Department, niveau chef/membre."""

from django.db import models


class Department(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Poste(models.Model):
    NIVEAU_CHEF = "chef"
    NIVEAU_MEMBRE = "membre"
    NIVEAUX = [(NIVEAU_CHEF, "Chef"), (NIVEAU_MEMBRE, "Membre")]

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="postes")
    titre = models.CharField(max_length=100)
    niveau = models.CharField(max_length=10, choices=NIVEAUX, default=NIVEAU_MEMBRE)

    class Meta:
        ordering = ["department__nom", "titre"]
        unique_together = [("department", "titre")]

    def __str__(self):
        return f"{self.titre} ({self.department})"
