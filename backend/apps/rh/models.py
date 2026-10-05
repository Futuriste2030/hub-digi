"""RH — SPEC §5.5 : Employee, Leave (workflow + validate), Candidature (webhook site),
pointage QR (SitePointage, QRToken, Pointage)."""

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


class SitePointage(models.Model):
    """Lieu + horaires de travail (08h00–17h00 verrouillés) — anti-fraude GPS.

    Un seul site actif : les coordonnées de l'entreprise + rayon de tolérance.
    """

    nom = models.CharField(max_length=255, default="Siège Digi Com")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    rayon_m = models.PositiveIntegerField(default=150,
        help_text="Distance max (mètres) entre l'employé et l'entreprise.")
    heure_arrivee = models.TimeField(help_text="Début journée (08:00).")
    heure_depart = models.TimeField(help_text="Fin journée (17:00).")
    tolerance_retard_min = models.PositiveIntegerField(default=15,
        help_text="Retard compté après heure_arrivee + tolérance (08:15).")
    prime_montant = models.PositiveIntegerField(default=25000,
        help_text="Prime proposée automatiquement à l'employé du mois (F CFA).")
    actif = models.BooleanField(default=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-actif", "nom"]

    def __str__(self):
        debut = str(self.heure_arrivee)[:5]
        fin = str(self.heure_depart)[:5]
        return f"{self.nom} ({debut}–{fin}, {self.rayon_m} m)"


class QRToken(models.Model):
    """Défi QR dynamique à usage unique (TTL court, anti-rejeu / anti-screenshot)."""

    employe = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="qr_tokens")
    nonce = models.CharField(max_length=64, unique=True)
    expire_le = models.DateTimeField()
    utilise = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"QR {self.employe} exp {self.expire_le:%H:%M:%S} {'(utilisé)' if self.utilise else ''}"


class Pointage(models.Model):
    """Un pointage par employé et par jour : arrivée + départ."""

    STATUT_HEURE = "a_l_heure"
    STATUT_RETARD = "retard"
    STATUTS_ARRIVEE = [(STATUT_HEURE, "À l'heure"), (STATUT_RETARD, "En retard")]
    STATUT_NORMAL = "normal"
    STATUT_ANTICIPE = "anticipe"
    STATUTS_DEPART = [(STATUT_NORMAL, "Normal"), (STATUT_ANTICIPE, "Anticipé")]

    employe = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="pointages")
    date = models.DateField()
    heure_arrivee = models.DateTimeField(null=True, blank=True)
    statut_arrivee = models.CharField(max_length=10, choices=STATUTS_ARRIVEE, blank=True)
    heure_depart = models.DateTimeField(null=True, blank=True)
    statut_depart = models.CharField(max_length=10, choices=STATUTS_DEPART, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    distance_m = models.FloatField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "employe__user__email"]
        unique_together = [("employe", "date")]

    def __str__(self):
        return f"{self.employe} le {self.date}"


class Prime(models.Model):
    """Prime mensuelle — proposée auto (employé du mois), validée par la RH."""

    employe = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="primes")
    mois = models.CharField(max_length=7, help_text="AAAA-MM")
    montant = models.PositiveIntegerField(help_text="Montant en F CFA.")
    motif = models.CharField(max_length=255, blank=True)
    validee = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-mois", "employe__user__email"]
        unique_together = [("employe", "mois")]

    def __str__(self):
        return f"Prime {self.mois} — {self.employe} ({self.montant} F)"
