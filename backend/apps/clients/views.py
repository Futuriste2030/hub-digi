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
    filterset_fields = ["statut", "slug", "code", "est_interne"]
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

    @action(detail=True, methods=["post"])
    def send_access(self, request, pk=None):
        """Invitation espace client — aucun mot de passe transmis.

        Crée le compte client s'il manque (mot de passe inutilisable), génère
        un lien d'activation uid/token 24h (même mécanisme que reset password,
        usage unique lié au hash) et l'envoie via le template
        ``bienvenue_espace_client`` avec l'identifiant + le lien espace.
        Le client définit lui-même son mot de passe sur /reset-password/:uid/:token.
        Réservé super_admin/admin. Renvoyer invalide le lien précédent.
        """
        from django.conf import settings
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        from django.utils.text import slugify

        from apps.accounts.models import User
        from apps.mailing.services import send_templated_mail

        if request.user.role not in ("super_admin", "admin"):
            return Response({"detail": "Envoi des accès réservé au Super Admin / Administration."}, status=403)
        client = self.get_object()
        if client.est_interne:
            return Response({"detail": "Client interne : aucun compte ni espace client."}, status=400)
        if not client.email:
            return Response({"detail": "Renseignez l'e-mail sur la fiche client."}, status=400)

        user = User.objects.filter(role="client", client=client).order_by("id").first()
        if user is None:
            base = (request.data.get("username") or client.nom_societe or "client").strip()
            username = slugify(base, allow_unicode=False).replace("-", ".")[:24].strip(".") or "client"
            candidat, i = username, 2
            while User.objects.filter(username__iexact=candidat).exists():
                suffix = f".{i}"
                candidat = (username[: 24 - len(suffix)] + suffix).strip(".")
                i += 1
            user = User(email=client.email, username=candidat, role="client", client=client)
            user.set_unusable_password()
            user.save()
        elif user.email.lower() != client.email.lower():
            user.email = client.email
            user.save(update_fields=["email"])

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        activation_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        espace_url = request.data.get("espace_url") or (
            f"{settings.FRONTEND_URL}/espace/{client.slug}/{client.code}"
            if client.slug and client.code
            else f"{settings.FRONTEND_URL}/espace"
        )
        mail = send_templated_mail(
            "bienvenue_espace_client", client.email,
            {"societe": client.nom_societe, "username": user.username,
             "espace_url": espace_url, "activation_url": activation_url},
            client=client,
        )
        if mail is None:
            return Response({"detail": "Template bienvenue_espace_client inactif ou introuvable."}, status=500)
        return Response(
            {"detail": f"Invitation envoyée à {client.email}.",
             "username": user.username, "email": user.email},
            status=200,
        )

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
