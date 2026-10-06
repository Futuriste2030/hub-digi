"""Projets + tâches + jalons + sprints + GitHub — SPEC §5.4/§12 + SPEC Jira v1.4."""

import hashlib
import hmac
import re

from django.db.models import Case, Count, IntegerField, Sum, When
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.models import AuditLog, Notification

from .models import LienGit, LivraisonWebhook, Milestone, Project, Sprint, Task
from .serializers import (
    CHAMPS_CHEF_DEV,
    CHAMPS_MEMBRE_DEV,
    IsChefDev,
    LienGitSerializer,
    LivraisonWebhookSerializer,
    MilestoneSerializer,
    ProjectSerializer,
    SprintSerializer,
    TaskSerializer,
    est_chef_dev,
)

REF_RE = re.compile(r"\b(?:TASK|BUG)-\d{4}-\d{4}\b", re.IGNORECASE)  # non-capturant : findall renvoie la réf complète.
ORDRE_PRIORITE = Case(
    When(priorite="critique", then=0), When(priorite="haute", then=1),
    When(priorite="normale", then=2), When(priorite="basse", then=3),
    default=2, output_field=IntegerField(),
)


def _est_chef(user):
    return est_chef_dev(user)


def _valeur_tache(t, mode_points):
    if mode_points:
        return t.estimation_points or 0
    return 1


def _jours_ouvres(debut, fin):
    """Jours ouvrés lun-ven entre deux dates incluses (convention RH)."""
    jours, cur = [], debut
    from datetime import timedelta

    while cur <= fin:
        if cur.weekday() < 5:
            jours.append(cur)
        cur += timedelta(days=1)
    return jours


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related("client").all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsChefDev]
    filterset_fields = ["client", "type", "statut"]
    search_fields = ["titre", "client__nom_societe", "github_repo"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(client_id=user.client_id)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs

    @action(detail=True, methods=["get"])
    def tasks(self, request, pk=None):
        project = self.get_object()
        return Response(TaskSerializer(project.taches.select_related("assigne").all(), many=True).data)

    @action(detail=True, methods=["get"])
    def milestones(self, request, pk=None):
        project = self.get_object()
        return Response(MilestoneSerializer(project.jalons.all(), many=True).data)

    @action(detail=True, methods=["get"])
    def bugs(self, request, pk=None):
        self.get_object()
        return Response([])

    @action(detail=True, methods=["get"], url_path="backlog")
    def backlog(self, request, pk=None):
        """Backlog = tâches du projet sans sprint et non terminées, triées priorité puis création."""
        project = self.get_object()
        qs = project.taches.filter(sprint__isnull=True).exclude(statut=Task.STATUT_DONE)
        qs = qs.select_related("assigne").order_by(ORDRE_PRIORITE, "cree_le")
        return Response(TaskSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="velocite")
    def velocite(self, request, pk=None):
        """Vélocité : N derniers sprints terminés + moyenne (calcul à la demande, sans Beat)."""
        project = self.get_object()
        try:
            n = max(1, min(int(request.query_params.get("n", 6)), 20))
        except (TypeError, ValueError):
            n = 6
        sprints = project.sprints.filter(statut=Sprint.STATUT_TERMINE).order_by("-termine_le", "-id")[:n]
        sprints = list(reversed(sprints))
        data = [{"sprint": s.id, "nom": s.nom, "points_engages": s.points_engages,
                 "points_termines": s.points_termines} for s in sprints]
        moyenne = round(sum(s["points_termines"] for s in data) / len(data), 1) if data else 0
        return Response({"sprints": data, "velocite_moyenne": moyenne})

    @action(detail=True, methods=["post"], url_path="github/regenerer-secret")
    def regenerer_secret(self, request, pk=None):
        """Régénère le secret webhook. Réservé chef_dev/super_admin. Secret affiché une seule fois."""
        if not _est_chef(request.user):
            return Response({"detail": "Réservé au Chef Développement."}, status=403)
        project = self.get_object()
        secret = project.regenerer_secret_github()
        try:
            AuditLog.objects.create(user=request.user, action="github_secret",
                                    objet=f"projet {project.id} secret régénéré")
        except Exception:
            pass
        webhook_url = request.build_absolute_uri(f"/api/v1/github/webhook/{project.id}/")
        return Response({"secret": secret, "webhook_url": webhook_url})

    @action(detail=True, methods=["get"], url_path="github/livraisons")
    def livraisons(self, request, pk=None):
        if not _est_chef(request.user):
            return Response({"detail": "Réservé au Chef Développement."}, status=403)
        project = self.get_object()
        qs = project.livraisons_webhook.all()[:20]
        return Response(LivraisonWebhookSerializer(qs, many=True).data)

    def destroy(self, request, *args, **kwargs):
        # IsChefDev déjà exigé ; on ajoute la garde statut + dépendances.
        obj = self.get_object()
        if obj.statut in ("termine", "en_review") or obj.taches.exists() or obj.jalons.exists():
            return Response({"detail": "Projet démarré ou avec tâches/jalons : archivage requis, suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.select_related("project", "assigne", "sprint").all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "statut", "assigne", "priorite", "sprint"]
    search_fields = ["titre", "reference"]
    ordering_fields = ["cree_le", "maj_le", "priorite", "estimation_points", "done_at"]
    ordering = ["cree_le"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(project__client_id=user.client_id)
        project_id = self.request.query_params.get("project_id") or self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def _refuser_si_champs_chef(self, request):
        if _est_chef(request.user):
            return None
        recus = set(request.data.keys()) if hasattr(request.data, "keys") else set()
        if recus & CHAMPS_CHEF_DEV:
            return Response({"detail": "Estimation, priorité et sprint réservés au Chef Développement (403)."}, status=403)
        if not recus <= CHAMPS_MEMBRE_DEV:
            return Response({"detail": "Membre Dev : déplacement et temps passé uniquement."}, status=403)
        return None

    def create(self, request, *args, **kwargs):
        if not _est_chef(request.user):
            return Response({"detail": "Création réservée au Chef Développement."}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        refus = self._refuser_si_champs_chef(request)
        if refus is not None:
            return refus
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        refus = self._refuser_si_champs_chef(request)
        if refus is not None:
            return refus
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _est_chef(request.user):
            return Response({"detail": "Suppression réservée au Chef Développement."}, status=403)
        obj = self.get_object()
        if obj.statut == "done":
            return Response({"detail": "Tâche terminée : suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path="liens-git")
    def liens_git(self, request, pk=None):
        tache = self.get_object()
        return Response(LienGitSerializer(tache.liens_git.all(), many=True).data)


class MilestoneViewSet(viewsets.ModelViewSet):
    queryset = Milestone.objects.select_related("project").all()
    serializer_class = MilestoneSerializer
    permission_classes = [IsAuthenticated, IsChefDev]
    filterset_fields = ["project", "statut"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(project__client_id=user.client_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.statut == "valide":
            return Response({"detail": "Jalon validé : suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)


class SprintViewSet(viewsets.ModelViewSet):
    queryset = Sprint.objects.select_related("project").prefetch_related("taches").all()
    serializer_class = SprintSerializer
    permission_classes = [IsAuthenticated, IsChefDev]
    filterset_fields = ["project", "statut"]
    search_fields = ["nom", "objectif"]
    ordering_fields = ["date_debut", "cree_le"]
    ordering = ["-cree_le"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(project__client_id=user.client_id)
        project_id = self.request.query_params.get("project_id") or self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        # Alias ?status= (spec) en plus de ?statut=.
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(statut=status)
        return qs

    def _points_taches(self, sprint):
        taches = list(sprint.taches.all())
        mode_points = any(t.estimation_points for t in taches)
        total = sum(_valeur_tache(t, mode_points) for t in taches)
        return taches, mode_points, total

    @action(detail=True, methods=["post"])
    def demarrer(self, request, pk=None):
        """Passe en actif + fige points_engages. Un seul actif par projet."""
        sprint = self.get_object()
        if sprint.statut == Sprint.STATUT_TERMINE:
            return Response({"detail": "Sprint déjà terminé."}, status=400)
        if Sprint.objects.filter(project=sprint.project, statut=Sprint.STATUT_ACTIF).exclude(id=sprint.id).exists():
            return Response({"detail": "Un sprint est déjà actif sur ce projet."}, status=400)
        _, _, total = self._points_taches(sprint)
        sprint.statut = Sprint.STATUT_ACTIF
        sprint.points_engages = total
        sprint.demarre_le = sprint.demarre_le or timezone.now()
        sprint.save(update_fields=["statut", "points_engages", "demarre_le", "maj_le"])
        return Response(SprintSerializer(sprint).data)

    @action(detail=True, methods=["post"])
    def terminer(self, request, pk=None):
        """Passe en terminé + fige points_termines. Tâches ouvertes -> sprint_cible ou backlog."""
        sprint = self.get_object()
        if sprint.statut == Sprint.STATUT_TERMINE:
            return Response({"detail": "Sprint déjà terminé."}, status=400)
        taches, mode_points, _ = self._points_taches(sprint)
        termine = sum(_valeur_tache(t, mode_points) for t in taches if t.statut == Task.STATUT_DONE)
        sprint_cible = request.data.get("sprint_cible")
        cible = None
        if sprint_cible:
            try:
                cible = Sprint.objects.get(id=sprint_cible, project=sprint.project)
            except (Sprint.DoesNotExist, ValueError, TypeError):
                return Response({"detail": "Sprint cible invalide (même projet requis)."}, status=400)
            if cible.statut == Sprint.STATUT_TERMINE:
                return Response({"detail": "Sprint cible déjà terminé."}, status=400)
        ouvertes = [t for t in taches if t.statut != Task.STATUT_DONE]
        for t in ouvertes:
            t.sprint = cible  # None = retour backlog par défaut.
            t.save(update_fields=["sprint", "sprint_added_at", "maj_le"])
        sprint.statut = Sprint.STATUT_TERMINE
        sprint.points_termines = termine
        sprint.termine_le = timezone.now()
        sprint.save(update_fields=["statut", "points_termines", "termine_le", "maj_le"])
        return Response(SprintSerializer(sprint).data)

    @action(detail=True, methods=["get"])
    def rapport(self, request, pk=None):
        """Burndown calculé à la demande (§3) : série par jour ouvré + totaux + temps."""
        from datetime import date

        sprint = self.get_object()
        taches = list(sprint.taches.all())
        mode_points = any(t.estimation_points for t in taches)
        engages = sprint.points_engages or sum(_valeur_tache(t, mode_points) for t in taches)
        jours = _jours_ouvres(sprint.date_debut, sprint.date_fin)
        total_jours = len(jours) or 1
        auj = date.today()
        serie = []
        for i, jour in enumerate(jours):
            if jour > auj:
                continue  # jours futurs non calculés.
            ideal = round(engages * (1 - (i + 1) / total_jours), 1)
            restant = 0
            for t in taches:
                termine_ce_jour = t.done_at is not None and t.done_at.date() <= jour
                if not termine_ce_jour:
                    restant += _valeur_tache(t, mode_points)
            serie.append({"date": jour.isoformat(), "restant_ideal": ideal, "restant_reel": restant})
        termines = sum(1 for t in taches if t.statut == Task.STATUT_DONE)
        ajoutes = sum(_valeur_tache(t, mode_points) for t in taches
                      if t.sprint_added_at and sprint.demarre_le and t.sprint_added_at > sprint.demarre_le)
        heures_est = float(sum((t.estimation_heures or 0) for t in taches))
        heures_fait = float(sum((t.temps_passe or 0) for t in taches))
        return Response({
            "sprint": sprint.id,
            "serie": serie,
            "totaux": {"points_engages": engages,
                       "points_termines": sprint.points_termines if sprint.statut == Sprint.STATUT_TERMINE
                       else engages - (serie[-1]["restant_reel"] if serie else engages),
                       "taches_terminees": termines, "taches_total": len(taches),
                       "points_ajoutes": ajoutes},
            "temps": {"heures_estimees": heures_est, "heures_passees": heures_fait},
        })


class LienGitViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LienGit.objects.select_related("task", "bug").all()
    serializer_class = LienGitSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["task", "bug", "type"]


# ---------------------------------------------------------------------------
# Webhook GitHub entrant (V1 sans OAuth, §4.3). Public + throttle dédié.
# ---------------------------------------------------------------------------

def _signature_valide(secret, corps, recue):
    if not secret or not recue:
        return False
    attendue = "sha256=" + hmac.new(secret.encode(), corps, hashlib.sha256).hexdigest()
    donnee = recue if recue.startswith("sha256=") else f"sha256={recue}"
    return hmac.compare_digest(donnee, attendue)


@api_view(["POST"])
@permission_classes([])
@throttle_classes([ScopedRateThrottle])
def webhook_github(request, project_id):
    try:
        project = Project.objects.get(id=project_id)
    except (Project.DoesNotExist, ValueError, TypeError):
        return Response({"detail": "Projet introuvable."}, status=404)
    if len(request.body) > 1_000_000:
        return Response({"detail": "Corps trop volumineux."}, status=413)
    if not _signature_valide(project.github_webhook_secret, request.body,
                             request.headers.get("X-Hub-Signature-256", "")):
        return Response({"detail": "Signature invalide."}, status=403)
    delivery = request.headers.get("X-GitHub-Delivery", "")
    event = request.headers.get("X-GitHub-Event", "")
    if delivery and LivraisonWebhook.objects.filter(delivery_id=delivery).exists():
        return Response({"detail": "Déjà traitée."}, status=200)
    if event == "ping":
        if delivery:
            LivraisonWebhook.objects.get_or_create(
                delivery_id=delivery, defaults={"event": event, "project": project})
        return Response({"detail": "pong"}, status=200)
    payload = request.data if isinstance(request.data, dict) else {}
    repo = ((payload.get("repository") or {}).get("full_name") or "")
    if project.github_repo and repo and repo.lower() != project.github_repo.lower():
        if delivery:
            LivraisonWebhook.objects.get_or_create(
                delivery_id=delivery, defaults={"event": event, "project": project,
                                                "statut_traitement": "ignore",
                                                "erreur": f"Dépôt {repo} ≠ {project.github_repo}"})
        return Response({"detail": "Dépôt ignoré."}, status=200)

    from apps.bugtracker.models import BugReport

    crees = 0

    def rattacher(refs, type_lien, identifiant, url="", titre="", auteur="", statut_pr=None):
        nonlocal crees
        for ref in {r.upper() for r in refs}:
            prefixe, _, _ = ref.partition("-")
            try:
                if prefixe == "TASK":
                    tache = Task.objects.get(reference__iexact=ref, project=project)
                    _, created = LienGit.objects.update_or_create(
                        task=tache, type=type_lien, identifiant_externe=identifiant,
                        defaults={"url": url[:500], "titre": titre[:255],
                                  "auteur_github": auteur[:255], "statut_pr": statut_pr})
                    if created:
                        crees += 1
                    _transition_auto(tache, type_lien, statut_pr, est_nouveau=created)
                else:
                    bug = BugReport.objects.get(numero__iexact=ref, project=project)
                    _, created = LienGit.objects.update_or_create(
                        bug=bug, type=type_lien, identifiant_externe=identifiant,
                        defaults={"url": url[:500], "titre": titre[:255],
                                  "auteur_github": auteur[:255], "statut_pr": statut_pr})
                    if created:
                        crees += 1
            except (Task.DoesNotExist, BugReport.DoesNotExist):
                continue  # références inconnues ou d'un autre projet : ignorées.

    def _transition_auto(tache, type_lien, statut_pr, est_nouveau):
        if not project.github_auto_statut or type_lien != LienGit.TYPE_PR:
            return
        if statut_pr == "ouverte" and tache.statut == Task.STATUT_A_FAIRE and est_nouveau:
            tache.statut = Task.STATUT_EN_COURS
            tache.save(update_fields=["statut", "maj_le"])
        elif statut_pr == "fusionnee" and tache.statut != Task.STATUT_DONE:
            tache.statut = Task.STATUT_REVIEW  # jamais done automatiquement.
            tache.save(update_fields=["statut", "maj_le"])

    if event == "push":
        branche = (payload.get("ref") or "").removeprefix("refs/heads/")
        for commit in payload.get("commits") or []:
            msg = commit.get("message") or ""
            sha = commit.get("id") or commit.get("sha") or ""
            rattacher(REF_RE.findall(msg), LienGit.TYPE_COMMIT, sha[:64] or msg[:64],
                      url=commit.get("url") or "", titre=msg.splitlines()[0] if msg else "",
                      auteur=((commit.get("author") or {}).get("username")
                              or (commit.get("author") or {}).get("name") or ""))
        if branche:
            rattacher(REF_RE.findall(branche), LienGit.TYPE_BRANCHE, branche[:255],
                      url=f"https://github.com/{repo}/tree/{branche}" if repo else "")
    elif event == "pull_request":
        pr = payload.get("pull_request") or {}
        action_pr = payload.get("action") or ""
        if action_pr in ("opened", "reopened", "edited", "closed"):
            numero = str(pr.get("number") or (payload.get("number")) or "")
            titre_pr = f"{pr.get('title') or ''}\n{pr.get('body') or ''}\n{((pr.get('head') or {}).get('ref')) or ''}"
            fusionnee = bool(pr.get("merged"))
            statut_pr = "fusionnee" if (action_pr == "closed" and fusionnee) else (
                "fermee" if action_pr == "closed" else "ouverte")
            rattacher(REF_RE.findall(titre_pr), LienGit.TYPE_PR, numero,
                      url=pr.get("html_url") or "", titre=(pr.get("title") or "")[:255],
                      auteur=((pr.get("user") or {}).get("login")) or "", statut_pr=statut_pr)
            if statut_pr == "fusionnee":
                _notifier_fusion(project)
    else:
        if delivery:
            LivraisonWebhook.objects.get_or_create(
                delivery_id=delivery, defaults={"event": event or "inconnu", "project": project,
                                                "statut_traitement": "ignore", "erreur": "Événement ignoré"})
        return Response({"detail": "Événement ignoré."}, status=202)
    if delivery:
        LivraisonWebhook.objects.get_or_create(
            delivery_id=delivery, defaults={"event": event, "project": project})
    else:
        LivraisonWebhook.objects.create(delivery_id=f"sans-id-{timezone.now().timestamp()}",
                                        event=event, project=project)
    try:
        AuditLog.objects.create(user=None, action="github_webhook",
                                objet=f"projet {project.id} {event} +{crees} liens")
    except Exception:
        pass
    return Response({"detail": "ok", "liens_crees": crees}, status=200)


def _notifier_fusion(project):
    from apps.accounts.models import User

    try:
        dests = User.objects.filter(role__in=["chef_dev", "super_admin"], is_active=True)
        for u in dests:
            Notification.objects.create(
                destinataire=u, titre=f"PR fusionnée — {project.titre}",
                texte="Une pull request liée a été fusionnée. À valider (jamais done auto).")
    except Exception:
        pass


webhook_github.throttle_scope = "webhook"
