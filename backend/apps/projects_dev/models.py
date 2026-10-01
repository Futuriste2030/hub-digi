"""Projets Dév + Kanban — SPEC §5.4/§11 : Project, Milestone (suivi client), Task."""

from django.conf import settings
from django.db import models


class Project(models.Model):
    TYPE_SITE_WEB = "site_web"
    TYPE_APP_WEB = "app_web"
    TYPE_APP_MOBILE = "app_mobile"
    TYPE_AUTRE = "autre"
    TYPES = [
        (TYPE_SITE_WEB, "Site web"),
        (TYPE_APP_WEB, "Application web"),
        (TYPE_APP_MOBILE, "Application mobile"),
        (TYPE_AUTRE, "Autre"),
    ]

    STATUT_A_FAIRE = "a_faire"
    STATUT_EN_COURS = "en_cours"
    STATUT_EN_REVIEW = "en_review"
    STATUT_TERMINE = "termine"
    STATUT_EN_PAUSE = "en_pause"
    STATUTS = [
        (STATUT_A_FAIRE, "À faire"),
        (STATUT_EN_COURS, "En cours"),
        (STATUT_EN_REVIEW, "En review"),
        (STATUT_TERMINE, "Terminé"),
        (STATUT_EN_PAUSE, "En pause"),
    ]

    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="projets")
    titre = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPES, default=TYPE_SITE_WEB)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_A_FAIRE)
    deadline = models.DateField(null=True, blank=True)
    repo_url = models.URLField(blank=True)
    # Tracker JS (§9) : généré si type web, phase 3. Champs prêts.
    tracker_public_key = models.CharField(max_length=64, blank=True)
    allowed_origins = models.TextField(blank=True)
    notes_deploiement = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"{self.titre} ({self.client})"

    @property
    def progression(self):
        total = self.taches.count()
        if not total:
            return 0
        done = self.taches.filter(statut=Task.STATUT_DONE).count()
        return round(done / total * 100)


class Milestone(models.Model):
    """Jalon = grande étape de validation convenue avec le client (SPEC §5.4, suivi client)."""

    STATUT_A_VENIR = "a_venir"
    STATUT_EN_COURS = "en_cours"
    STATUT_VALIDE = "valide"
    STATUTS = [
        (STATUT_A_VENIR, "À venir"),
        (STATUT_EN_COURS, "En cours"),
        (STATUT_VALIDE, "Validé"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="jalons")
    titre = models.CharField(max_length=255)
    date = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_A_VENIR)

    class Meta:
        ordering = ["date", "id"]

    def __str__(self):
        return f"{self.project} — {self.titre}"


class Task(models.Model):
    """Tâche Kanban interne : à faire / en cours / review / done (SPEC §5.4)."""

    STATUT_A_FAIRE = "a_faire"
    STATUT_EN_COURS = "en_cours"
    STATUT_REVIEW = "review"
    STATUT_DONE = "done"
    STATUTS = [
        (STATUT_A_FAIRE, "À faire"),
        (STATUT_EN_COURS, "En cours"),
        (STATUT_REVIEW, "Review"),
        (STATUT_DONE, "Done"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="taches")
    titre = models.CharField(max_length=255)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_A_FAIRE)
    assigne = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches"
    )
    temps_passe = models.DecimalField(max_digits=6, decimal_places=1, default=0)  # heures
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["cree_le"]

    def __str__(self):
        return f"{self.project} — {self.titre} ({self.statut})"
