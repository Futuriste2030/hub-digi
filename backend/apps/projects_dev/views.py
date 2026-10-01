"""Projets + tâches + jalons — SPEC §5.4/§12 : /projects/ :id/tasks/ :id/milestones/ :id/bugs/."""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Milestone, Project, Task
from .serializers import IsChefDev, MilestoneSerializer, ProjectSerializer, TaskSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related("client").all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsChefDev]
    filterset_fields = ["client", "type", "statut"]
    search_fields = ["titre", "client__nom_societe"]

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
        # Phase 3 (bugtracker) : renverra les BugReport du projet. Squelette en attendant.
        self.get_object()
        return Response([])

    def destroy(self, request, *args, **kwargs):
        # IsChefDev déjà exigé ; on ajoute la garde statut + dépendances.
        obj = self.get_object()
        if obj.statut in ("termine", "en_review") or obj.taches.exists() or obj.jalons.exists():
            return Response({"detail": "Projet démarré ou avec tâches/jalons : archivage requis, suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.select_related("project", "assigne").all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsChefDev]
    filterset_fields = ["project", "statut", "assigne"]
    search_fields = ["titre"]
    ordering_fields = ["cree_le", "maj_le"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(project__client_id=user.client_id)
        project_id = self.request.query_params.get("project_id")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.statut == "done":
            return Response({"detail": "Tâche terminée : suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)


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
