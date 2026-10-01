"""RH — SPEC §5.5 : Employee, Leave (workflow + validate), Candidature (webhook site)."""

from django.conf import settings
from django.db import models


class Employee(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fiche_employe")
    fonction = models.CharField(max_length=100, blank=True)
    date_embauche = models.DateField(null=True, blank=True)
    solde_conges = models.DecimalField(max_digits=5, decimal_places=1, default=30)  # jours
    en_conge = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user} ({self.fonction})"


class Leave(models.Model):
    STATUT_ATTENTE = "en_attente"
    STATUT_VALIDE = "valide"
    STATUT_REFUSE = "refuse"
    STATUT_ANNULE = "annule"
    STATUTS = [(STATUT_ATTENTE, "En attente"), (STATUT_VALIDE, "Validé"),
               (STATUT_REFUSE, "Refusé"), (STATUT_ANNULE, "Annulé")]

    employe = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="conges")
    du_jour = models.DateField()
    au_jour = models.DateField()
    motif = models.CharField(max_length=255, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_ATTENTE)
    valideur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="conges_valides")
    commentaire = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    @property
    def duree(self):
        return (self.au_jour - self.du_jour).days + 1


class Candidature(models.Model):
    STATUT_RECUE = "recue"
    STATUT_ENTRETIEN = "entretien"
    STATUT_RETENUE = "retenue"
    STATUT_REJETEE = "rejetee"
    STATUTS = [(STATUT_RECUE, "Reçue"), (STATUT_ENTRETIEN, "Entretien"),
               (STATUT_RETENUE, "Retenue"), (STATUT_REJETEE, "Rejetée")]

    offre_reference = models.CharField(max_length=100, blank=True)
    offre_titre = models.CharField(max_length=255, blank=True)
    nom = models.CharField(max_length=255)
    email = models.EmailField()
    telephone = models.CharField(max_length=50, blank=True)
    message = models.TextField(blank=True)
    cv_url = models.URLField(blank=True)
    source = models.CharField(max_length=20, default="manuelle")  # site | manuelle
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_RECUE)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
        unique_together = [("email", "offre_reference")]

    def __str__(self):
        return f"{self.nom} — {self.offre_titre or self.offre_reference}"
