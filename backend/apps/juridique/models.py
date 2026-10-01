"""Juridique — SPEC §5.6 : Contract (échéances), Dispute (litiges)."""

from django.db import models
from django.utils import timezone


class Contract(models.Model):
    TYPES = [("client", "Client"), ("employe", "Employé")]

    titre = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPES, default="client")
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="contrats")
    employe = models.ForeignKey("rh.Employee", null=True, blank=True, on_delete=models.SET_NULL, related_name="contrats")
    fichier = models.FileField(upload_to="contrats/", null=True, blank=True)
    contenu = models.TextField(blank=True, help_text="Rédaction depuis un modèle")
    date_fin = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=50, default="actif")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.titre

    @property
    def jours_restants(self):
        if not self.date_fin:
            return None
        return (self.date_fin - timezone.now().date()).days


class Dispute(models.Model):
    STATUTS = [("ouvert", "Ouvert"), ("en_cours", "En cours"), ("resolu", "Résolu"), ("clos", "Clos")]

    titre = models.CharField(max_length=255)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="litiges")
    partie = models.CharField(max_length=255, blank=True, help_text="Personne ou entreprise concernée (saisie libre)")
    statut = models.CharField(max_length=20, choices=STATUTS, default="ouvert")
    description = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.titre
