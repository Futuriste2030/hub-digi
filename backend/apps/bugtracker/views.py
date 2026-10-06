"""Bug tracker API — SPEC §9 : report public throttled + CRUD interne + convertir en tâche."""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.projects_dev.models import Task

from .models import BugReport, ProjectTrackerKey


class BugReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugReport
        fields = ["id", "numero", "project", "titre", "description", "gravite",
                  "statut", "assigne", "tache", "meta", "cree_le"]
        read_only_fields = ["numero", "tache"]


class TrackerKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTrackerKey
        fields = ["id", "project", "public_key", "allowed_origins", "cree_le"]
        read_only_fields = ["public_key"]


class TrackerKeyViewSet(viewsets.ModelViewSet):
    """Clés tracker.js : lecture + génération (auto si projet web, SPEC §9)."""

    queryset = ProjectTrackerKey.objects.select_related("project").all()
    serializer_class = TrackerKeySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project"]


class BugReportViewSet(viewsets.ModelViewSet):
    queryset = BugReport.objects.select_related("project").all()
    serializer_class = BugReportSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "statut", "gravite"]
    search_fields = ["numero", "titre"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(project__client_id=user.client_id)
        return qs

    @action(detail=True, methods=["post"])
    def convertir(self, request, pk=None):
        """Bug -> tâche Kanban liée (SPEC §9)."""
        bug = self.get_object()
        if bug.tache:
            return Response({"detail": "Déjà converti."}, status=400)
        tache = Task.objects.create(project=bug.project, titre=f"[{bug.numero}] {bug.titre}",
                                    statut=Task.STATUT_A_FAIRE, assigne=bug.assigne)
        bug.tache = tache
        bug.statut = BugReport.STATUTS[2][0]
        bug.save()
        return Response(BugReportSerializer(bug).data, status=201)


@api_view(["POST"])
@permission_classes([])
@throttle_classes([ScopedRateThrottle])
def report_bug(request):
    """Endpoint public du tracker.js : {key, message, stack, url, meta}."""
    from django.conf import settings
    from django.core.mail import send_mail

    from apps.accounts.models import User
    from apps.core.models import Notification

    key = request.data.get("key", "")
    try:
        tracker = ProjectTrackerKey.objects.select_related("project").get(public_key=key)
    except ProjectTrackerKey.DoesNotExist:
        return Response({"detail": "clé invalide"}, status=403)
    bug = BugReport.objects.create(
        project=tracker.project,
        titre=request.data.get("message", "Erreur JS")[:255],
        description=request.data.get("stack", ""),
        gravite=request.data.get("gravite") if request.data.get("gravite") in dict(
            BugReport.GRAVITES) else "moyenne",
        meta={"url": request.data.get("url", ""), **(request.data.get("meta") or {})},
    )
    # Notif in-app (cloche) : Chef Dév + Super Admin à chaque bug,
    # + Administration si critique. Mail si critique (jamais bloquant).
    # + Alerte mail systématique au responsable (toutes gravités) : couvre le
    # cas hors-ligne (le mail attend dans la boîte, contrairement à la cloche).
    try:
        roles = ["chef_dev", "super_admin"]
        if bug.gravite == "critique":
            roles.append("admin")
        destinataires = User.objects.filter(role__in=roles, is_active=True)
        titre = f"Bug {bug.numero} — {tracker.project.titre}"
        for u in destinataires:
            Notification.objects.create(
                destinataire=u, titre=titre,
                texte=f"{bug.titre} · {request.data.get('url', '—')}")
        if bug.gravite == "critique":
            courriels = [u.email for u in destinataires if u.email]
            if courriels:
                from apps.mailing.models import EmailIdentity

                identite = EmailIdentity.objects.filter(
                    department__slug="developpement").first()
                send_mail(
                    f"[CRITIQUE] {titre}", bug.titre,
                    identite.from_address if identite else settings.DEFAULT_FROM_EMAIL,
                    courriels, fail_silently=True)
        alerte = getattr(settings, "BUG_ALERT_EMAIL", "")
        if alerte:
            url_bug = request.data.get("url", "—")
            send_mail(
                f"[HUB BUG {bug.gravite}] {bug.numero} — {tracker.project.titre}",
                f"Bug {bug.numero} ({bug.gravite}) sur « {tracker.project.titre} ».\n\n"
                f"Titre : {bug.titre}\nPage : {url_bug}\n\n"
                f"Voir : {settings.FRONTEND_URL}/dev/bugs",
                settings.DEFAULT_FROM_EMAIL,
                [alerte], fail_silently=True)
    except Exception:
        pass
    return Response({"numero": bug.numero}, status=201)


report_bug.throttle_scope = "bugs"
