"""Portail client lecture seule — SPEC §6 : GET /portal/dashboard/ (where client_id = me.client_id).

V1 : projets + jalons réels. Factures, tickets, bugs branchés en phases 2-3
(les apps finance / secretariat_tickets / bugtracker enrichiront ce endpoint).
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.clients.serializers import ClientSerializer
from apps.projects_dev.models import Project
from apps.projects_dev.serializers import MilestoneSerializer, ProjectSerializer


class DashboardClientView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        client_id = user.client_id
        # Aperçu super_admin : ?client= (comme le frontend /espace-client).
        if user.role == "super_admin":
            client_id = request.query_params.get("client") or client_id
        if not client_id:
            return Response({"detail": "Aucun compte client lié."}, status=400)

        projets = Project.objects.filter(client_id=client_id).select_related("client").prefetch_related("jalons")
        data_projets = ProjectSerializer(projets, many=True).data
        jalons = []
        for p in projets:
            for j in p.jalons.all():
                item = MilestoneSerializer(j).data
                item["project_titre"] = p.titre
                jalons.append(item)

        from apps.clients.models import Client

        client = Client.objects.filter(id=client_id).first()
        if not client:
            return Response({"detail": "Compte client introuvable."}, status=404)
        if client.est_interne and user.role == "client":
            return Response({"detail": "Client interne : aucun espace client."}, status=403)

        from apps.bugtracker.models import BugReport
        from apps.bugtracker.views import BugReportSerializer
        from apps.finance.models import Invoice
        from apps.finance.views import DevisSerializer, InvoiceSerializer
        from apps.secretariat_tickets.models import Ticket
        from apps.secretariat_tickets.views import TicketSerializer

        factures = Invoice.objects.filter(client_id=client_id).exclude(
            statut__in=[Invoice.STATUT_BROUILLON, Invoice.STATUT_VALIDEE]
        ).prefetch_related("lignes", "recus")
        return Response(
            {
                "client": ClientSerializer(client).data if client else None,
                "projets": data_projets,
                "jalons": jalons,
                "factures": InvoiceSerializer(factures, many=True).data,
                "factures_impayees": float(sum((f.solde for f in factures if f.statut != Invoice.STATUT_PAYEE), 0)),
                "devis": DevisSerializer(client.devis.all(), many=True).data if client else [],
                "tickets": TicketSerializer(Ticket.objects.filter(client_id=client_id), many=True).data,
                "bugs": BugReportSerializer(BugReport.objects.filter(project__client_id=client_id), many=True).data,
            }
        )
