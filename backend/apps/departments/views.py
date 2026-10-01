from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsSuperAdmin

from .models import Department, Poste
from .serializers import DepartmentSerializer, PosteSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["slug"]
    search_fields = ["nom"]


class PosteViewSet(viewsets.ModelViewSet):
    queryset = Poste.objects.select_related("department").all()
    serializer_class = PosteSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["department", "niveau"]
    search_fields = ["titre"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsSuperAdmin()]
        return [IsAuthenticated()]
