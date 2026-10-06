"""Projets Dév + Kanban — SPEC §5.4/§11 + SPEC Jira v1.4 : Project, Milestone, Task, Sprint, LienGit, LivraisonWebhook."""

import re
import secrets

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


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
    # GitHub V1 sans OAuth (§4) : webhook entrant uniquement, jamais d'appel API sortant.
    github_repo = models.CharField(max_length=255, blank=True, help_text="owner/nom, déduit de repo_url si possible")
    github_webhook_secret = models.CharField(max_length=128, blank=True)
    github_auto_statut = models.BooleanField(default=False)
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

    def save(self, *args, **kwargs):
        if not self.github_repo and self.repo_url:
            m = re.search(r"github\.com[/:]([\w.\-]+/[\w.\-]+)", self.repo_url)
            if m:
                self.github_repo = m.group(1).removesuffix(".git")
        super().save(*args, **kwargs)

    def regenerer_secret_github(self):
        self.github_webhook_secret = secrets.token_urlsafe(32)
        self.save(update_fields=["github_webhook_secret", "maj_le"])
        return self.github_webhook_secret


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


class Sprint(models.Model):
    """Cycle de travail façon Jira (§2) : un seul actif par projet."""

    STATUT_PLANIFIE = "planifie"
    STATUT_ACTIF = "actif"
    STATUT_TERMINE = "termine"
    STATUTS = [
        (STATUT_PLANIFIE, "Planifié"),
        (STATUT_ACTIF, "Actif"),
        (STATUT_TERMINE, "Terminé"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sprints")
    nom = models.CharField(max_length=255)
    objectif = models.TextField(blank=True)
    date_debut = models.DateField()
    date_fin = models.DateField()
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_PLANIFIE)
    points_engages = models.IntegerField(default=0)
    points_termines = models.IntegerField(default=0)
    demarre_le = models.DateTimeField(null=True, blank=True)
    termine_le = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"{self.project} — {self.nom} ({self.statut})"


class Task(models.Model):
    """Tâche Kanban interne : à faire / en cours / review / done (SPEC §5.4 + Jira §1-2)."""

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

    PRIORITE_BASSE = "basse"
    PRIORITE_NORMALE = "normale"
    PRIORITE_HAUTE = "haute"
    PRIORITE_CRITIQUE = "critique"
    PRIORITES = [
        (PRIORITE_BASSE, "Basse"),
        (PRIORITE_NORMALE, "Normale"),
        (PRIORITE_HAUTE, "Haute"),
        (PRIORITE_CRITIQUE, "Critique"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="taches")
    titre = models.CharField(max_length=255)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_A_FAIRE)
    assigne = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches"
    )
    temps_passe = models.DecimalField(max_digits=6, decimal_places=1, default=0)  # heures
    # Jira §1 : estimation + priorité + référence + done_at (temps réel distinct de l'estimation).
    reference = models.CharField(max_length=20, unique=True, blank=True)
    estimation_points = models.PositiveIntegerField(null=True, blank=True)
    estimation_heures = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    priorite = models.CharField(max_length=20, choices=PRIORITES, default=PRIORITE_NORMALE)
    done_at = models.DateTimeField(null=True, blank=True)
    # Jira §2 : sprint + date d'affectation (flag "ajoutée en cours de sprint").
    sprint = models.ForeignKey(Sprint, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches")
    sprint_added_at = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["cree_le"]

    def __str__(self):
        return f"{self.reference or '?'} {self.project} — {self.titre} ({self.statut})"

    def save(self, *args, **kwargs):
        if not self.reference:
            from .references import generer_reference_task

            self.reference = generer_reference_task()
        # done_at auto : renseigné au passage en done, vidé à la réouverture.
        if self.statut == self.STATUT_DONE and self.done_at is None:
            self.done_at = timezone.now()
        elif self.statut != self.STATUT_DONE and self.done_at is not None:
            # Ne pas écraser aveuglément : si seul un autre champ change, done_at reste null.
            pass
            self.done_at = None
        # Trace l'ajout au sprint (comparé à demarre_le pour le flag en-cours-de-sprint).
        if self.pk:
            try:
                ancien = Task.objects.only("sprint").get(pk=self.pk)
                if ancien.sprint_id != (self.sprint_id or None):
                    self.sprint_added_at = timezone.now() if self.sprint_id else None
            except Task.DoesNotExist:
                pass
        elif self.sprint_id and not self.sprint_added_at:
            self.sprint_added_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def ajoutee_en_cours_de_sprint(self):
        if not self.sprint_id or not self.sprint_added_at:
            return False
        demarre = getattr(self.sprint, "demarre_le", None)
        return bool(demarre and self.sprint_added_at > demarre)


class LienGit(models.Model):
    """Lien commit/PR/branche <-> tâche ou bug du même projet (§4.2)."""

    TYPE_COMMIT = "commit"
    TYPE_PR = "pull_request"
    TYPE_BRANCHE = "branche"
    TYPES = [(TYPE_COMMIT, "Commit"), (TYPE_PR, "Pull request"), (TYPE_BRANCHE, "Branche")]

    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.CASCADE, related_name="liens_git")
    bug = models.ForeignKey("bugtracker.BugReport", null=True, blank=True, on_delete=models.CASCADE,
                             related_name="liens_git")
    type = models.CharField(max_length=20, choices=TYPES)
    identifiant_externe = models.CharField(max_length=255)
    url = models.URLField(blank=True)
    titre = models.CharField(max_length=255, blank=True)
    auteur_github = models.CharField(max_length=255, blank=True)
    statut_pr = models.CharField(
        max_length=20, null=True, blank=True,
        choices=[("ouverte", "Ouverte"), ("fusionnee", "Fusionnée"), ("fermee", "Fermée")],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Exactement un des deux renseigné.
            models.CheckConstraint(
                check=(Q(task__isnull=False) & Q(bug__isnull=True))
                | (Q(task__isnull=True) & Q(bug__isnull=False)),
                name="liengit_task_ou_bug",
            ),
            models.UniqueConstraint(fields=["task", "type", "identifiant_externe"], name="uniq_lien_task"),
            models.UniqueConstraint(fields=["bug", "type", "identifiant_externe"], name="uniq_lien_bug"),
        ]

    def __str__(self):
        cible = self.task.reference if self.task_id else (self.bug.numero if self.bug_id else "?")
        return f"{cible} ← {self.type} {self.identifiant_externe}"


class LivraisonWebhook(models.Model):
    """Historique + idempotence des webhooks GitHub (§4.2)."""

    delivery_id = models.CharField(max_length=128, unique=True)
    event = models.CharField(max_length=50)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="livraisons_webhook")
    statut_traitement = models.CharField(max_length=20, default="ok")
    erreur = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event} {self.delivery_id} ({self.statut_traitement})"
