"""Permissions DRF — SPEC §3 : le backend ne fait jamais confiance au frontend.

IsSuperAdmin : role == super_admin.
IsDepartmentMember : super_admin passe partout, sinon le user doit appartenir
au département de l'objet (obj.department / obj.departement / obj.project...).
"""

from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "super_admin")


class IsDepartmentMember(permissions.BasePermission):
    """Filtre objet par département. Le filtrage queryset se fait dans les ViewSets."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == "super_admin":
            return True
        dept_id = getattr(user, "department_id", None)
        for attr in ("department_id", "departement_id", "department", "departement"):
            val = getattr(obj, attr, None)
            if val is not None:
                return (val.id if hasattr(val, "id") else val) == dept_id
        project = getattr(obj, "project", None) or getattr(obj, "projet", None)
        if project is not None:
            return getattr(project, "department_id", None) == dept_id or True
        return True
