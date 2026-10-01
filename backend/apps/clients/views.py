"""Clients + overview 360° — SPEC §4 : GET /clients/:id/overview/."""

from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.annotate(
        projets_count=Count("projets", distinct=True),
        tickets_ouverts=Count("tickets", filter=~Q(tickets__statut__in=["clos", "repondu"]), distinct=True),
        factures_impayees=Count("factures", filter=Q(factures__statut="impayee"), distinct=True),
    ).all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["statut", "slug", "code"]
    search_fields = ["nom_societe", "contact", "email"]
    ordering = ["nom_societe"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Client : uniquement son propre compte (SPEC §3).
        if user.role == "client" and user.client_id:
            return qs.filter(id=user.client_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        # SPEC §3 + niveaux : clients.delete = super_admin/admin seuls (niveau 5-6).
        if request.user.role not in ("super_admin", "admin"):
            return Response({"detail": "Suppression réservée au Super Admin / Administration."}, status=403)
        client = self.get_object()
        dependances = (
            client.projets.count() + client.tickets.count() + client.factures.count()
            + client.devis.count() + client.campagnes.count() + client.medias.count()
        )
        if dependances > 0:
            return Response(
                {"detail": "Client lié à des projets, tickets ou documents : suppression impossible, désactivez ou archivez."},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def overview(self, request, pk=None):
        """Fiche 360° — SPEC §4 : agrège projets, com, finance, juridique, tickets, docs."""
        from apps.bugtracker.models import BugReport
        from apps.com.views import CampaignSerializer, PublicationSerializer
        from apps.finance.models import Invoice
        from apps.finance.views import DevisSerializer, InvoiceSerializer, ReceiptSerializer
        from apps.juridique.views import ContractSerializer
        from apps.mailing.views import SentMailSerializer
        from apps.projects_dev.serializers import ProjectSerializer
        from apps.secretariat_tickets.views import TicketSerializer

        client = self.get_object()
        projets = client.projets.select_related().all()
        factures = Invoice.objects.filter(client=client).prefetch_related("lignes", "recus")
        return Response(
            {
                "client": ClientSerializer(client).data,
                "projets": ProjectSerializer(projets, many=True).data,
                "bugs_ouverts": BugReport.objects.filter(project__client=client).exclude(statut="corrige").count(),
                "com": {
                    "campagnes": CampaignSerializer(client.campagnes.all(), many=True).data,
                    "calendrier": PublicationSerializer(client.publications.all(), many=True).data,
                },
                "finance": {
                    "devis": DevisSerializer(client.devis.all(), many=True).data,
                    "factures": InvoiceSerializer(factures, many=True).data,
                    "recus": [r for f in factures for r in ReceiptSerializer(f.recus.all(), many=True).data],
                    "solde_impayes": float(sum((f.solde for f in factures if f.statut != Invoice.STATUT_PAYEE), 0)),
                },
                "juridique": ContractSerializer(client.contrats.all(), many=True).data,
                "tickets": TicketSerializer(client.tickets.all(), many=True).data,
                "mails": SentMailSerializer(client.sentmail_set.all() if hasattr(client, "sentmail_set") else [], many=True).data,
            }
        )
