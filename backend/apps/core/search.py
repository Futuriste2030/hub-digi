"""Recherche globale transverse (§5 SPEC Jira) : un seul champ, SQLite icontains, sans moteur externe.

GET /api/v1/search/?q= (minimum 2 caracteres). Resultats groupes par type,
limites a 8 par entite, avec id/type/titre/reference/url interne uniquement.
Permissions : memes querysets filtres que les modules, jamais de requete brute.
Role client exclu (liste vide).
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def _interne(user):
    return getattr(user, "role", None) != "client"


class RechercheGlobaleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"detail": "Recherche de 2 caractères minimum (q=)."}, status=400)
        user = request.user
        if not _interne(user):
            return Response({"groupes": []})
        role = getattr(user, "role", None)
        groupes = []

        def peut(*roles):
            return role in roles

        # Tâches (référence, titre) — dev + super_admin.
        if peut("super_admin", "chef_dev", "membre_dev"):
            from apps.projects_dev.models import Task

            qs = Task.objects.select_related("project")
            if role == "membre_dev":
                pass  # même scope lecture que le module (tous projets internes).
            for t in qs.filter(reference__icontains=q)[:3]:
                groupes.append(("tache", t))
            for t in qs.filter(titre__icontains=q).exclude(reference__icontains=q)[:5]:
                groupes.append(("tache", t))
        # Bugs — dev + super_admin.
        if peut("super_admin", "chef_dev", "membre_dev"):
            from apps.bugtracker.models import BugReport

            for b in BugReport.objects.filter(numero__icontains=q)[:3]:
                groupes.append(("bug", b))
            for b in BugReport.objects.filter(titre__icontains=q).exclude(numero__icontains=q)[:5]:
                groupes.append(("bug", b))
        # Projets — dev + super_admin.
        if peut("super_admin", "chef_dev", "membre_dev"):
            from apps.projects_dev.models import Project

            for p in Project.objects.select_related("client").filter(titre__icontains=q)[:8]:
                groupes.append(("projet", p))
        # Clients — tous internes.
        if _interne(user):
            from apps.clients.models import Client

            for c in Client.objects.filter(nom_societe__icontains=q)[:8]:
                groupes.append(("client", c))
        # Tickets — tous internes.
        if _interne(user):
            from apps.secretariat_tickets.models import Ticket

            for t in Ticket.objects.filter(numero__icontains=q)[:3]:
                groupes.append(("ticket", t))
            for t in Ticket.objects.filter(sujet__icontains=q).exclude(numero__icontains=q)[:5]:
                groupes.append(("ticket", t))
        # Devis / factures — finance + super_admin uniquement (membre_dev = rien).
        if peut("super_admin", "chef_finance", "membre_finance"):
            from apps.finance.models import Devis, Invoice

            for d in Devis.objects.filter(numero__icontains=q)[:4]:
                groupes.append(("devis", d))
            for f in Invoice.objects.filter(numero__icontains=q)[:4]:
                groupes.append(("facture", f))
        # Courriers — secrétariat (super_admin, admin).
        if peut("super_admin", "admin"):
            from apps.secretariat_tickets.models import Courrier

            for c in Courrier.objects.filter(reference__icontains=q)[:4]:
                groupes.append(("courrier", c))
            for c in Courrier.objects.filter(objet__icontains=q).exclude(reference__icontains=q)[:4]:
                groupes.append(("courrier", c))

        par_type = {}
        for type_, obj in groupes:
            par_type.setdefault(type_, []).append(_fiche(type_, obj))
        return Response({"groupes": [{"type": k, "resultats": v[:8]} for k, v in par_type.items()]})


def _fiche(type_, obj):
    if type_ == "tache":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": getattr(obj, "reference", ""), "url": f"/projets/{obj.project_id}"}
    if type_ == "bug":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": getattr(obj, "numero", ""), "url": "/dev/bugs"}
    if type_ == "projet":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": "", "url": f"/projets/{obj.id}"}
    if type_ == "client":
        return {"id": obj.id, "type": type_, "titre": getattr(obj, "nom_societe", str(obj)),
                "reference": "", "url": f"/clients/{obj.id}"}
    if type_ == "ticket":
        return {"id": obj.id, "type": type_, "titre": getattr(obj, "numero", str(obj)),
                "reference": getattr(obj, "numero", ""), "url": "/tickets"}
    if type_ == "devis":
        return {"id": obj.id, "type": type_, "titre": getattr(obj, "numero", str(obj)),
                "reference": getattr(obj, "numero", ""), "url": "/finance/devis"}
    if type_ == "facture":
        return {"id": obj.id, "type": type_, "titre": getattr(obj, "numero", str(obj)),
                "reference": getattr(obj, "numero", ""), "url": f"/factures/{getattr(obj, 'numero', obj.id)}"}
    return {"id": obj.id, "type": type_, "titre": getattr(obj, "reference", str(obj)),
            "reference": getattr(obj, "reference", ""), "url": "/secretariat/courriers"}
