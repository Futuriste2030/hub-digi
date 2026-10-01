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
    # Signature électronique du salarié (contrat employé) : nom saisi + horodatage
    # + empreinte du contenu signé. Toute modification du contenu/titre par le
    # Juridique après signature invalide celle-ci (à re-signer).
    signature_employe_nom = models.CharField(max_length=255, blank=True)
    signature_employe_le = models.DateTimeField(null=True, blank=True)
    signature_employe_hash = models.CharField(max_length=64, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.titre

    @property
    def est_signe_employe(self):
        return bool(self.signature_employe_le and self.signature_employe_hash)

    def empreinte_signature(self):
        """Empreinte du document signé : détecte toute altération post-signature."""
        import hashlib

        base = f"{self.pk}|{self.titre}|{self.contenu}|{self.employe.user.email if self.employe_id else ''}"
        return hashlib.sha256(base.encode()).hexdigest()[:32]

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
