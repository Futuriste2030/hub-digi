"""Tickets/secrétariat API — SPEC §5.2/§7 : qualify/request-approval/reply + réunions/courriers."""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.projects_dev.models import Task

from .models import Courrier, Decharge, DecisionReunion, Reunion, Ticket, TicketApproval, TicketMessage


class TicketMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = ["id", "ticket", "auteur", "is_internal", "message", "cree_le"]
        read_only_fields = ["auteur"]


class TicketApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketApproval
        fields = ["id", "ticket", "demandeur", "valideur", "decision", "commentaire", "reponse_proposee", "cree_le"]
        read_only_fields = ["demandeur"]


class TicketSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_societe", read_only=True)
    project_titre = serializers.CharField(source="project.titre", read_only=True)

    class Meta:
        model = Ticket
        fields = ["id", "numero", "client", "client_nom", "project", "project_titre", "dept_assigne",
                  "categorie", "priorite", "statut", "sujet", "message", "cree_le"]
        read_only_fields = ["numero", "statut"]


class CourrierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Courrier
        fields = ["id", "reference", "sens", "objet", "expediteur", "destinataire", "date", "statut", "contenu"]
        read_only_fields = ["reference"]


class DechargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Decharge
        fields = ["id", "reference", "provenance", "objet", "montant", "date_recue",
                  "image", "poids_ko", "commentaire", "cree_le"]
        read_only_fields = ["reference", "poids_ko"]


class DecisionSerializer(serializers.ModelSerializer):
    responsable_email = serializers.CharField(source="responsable.email", read_only=True)

    class Meta:
        model = DecisionReunion
        fields = ["id", "reunion", "texte", "responsable", "responsable_email", "echeance", "tache", "cree_le"]
        read_only_fields = ["tache"]


class ReunionSerializer(serializers.ModelSerializer):
    decisions = DecisionSerializer(many=True, read_only=True)

    class Meta:
        model = Reunion
        fields = ["id", "titre", "date", "heure", "lieu", "participants", "statut", "ordre_du_jour", "pv", "decisions"]


class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.select_related("client", "project").all()
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "project", "dept_assigne", "statut", "priorite"]
    search_fields = ["numero", "sujet"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(client_id=user.client_id)
        return qs

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        ticket = self.get_object()
        return Response(TicketMessageSerializer(ticket.messages.select_related("auteur").all(), many=True).data)

    @action(detail=True, methods=["get"])
    def approvals(self, request, pk=None):
        ticket = self.get_object()
        return Response(TicketApprovalSerializer(ticket.approvals.all(), many=True).data)

    @action(detail=True, methods=["post"])
    def clore(self, request, pk=None):
        ticket = self.get_object()
        ticket.statut = Ticket.CLOS
        ticket.save()
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        ticket = self.get_object()
        ticket.statut = Ticket.QUALIFIE
        ticket.save()
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def rejeter(self, request, pk=None):
        ticket = self.get_object()
        ticket.statut = Ticket.REJETE
        ticket.save()
        if request.data.get("motif"):
            TicketMessage.objects.create(ticket=ticket, auteur=request.user, is_internal=True,
                                          message=f"Motif du rejet : {request.data['motif']}")
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def qualify(self, request, pk=None):
        """Secrétariat qualifie : catégorie, priorité, dept assigné (SPEC §7.3)."""
        ticket = self.get_object()
        ticket.categorie = request.data.get("categorie", ticket.categorie)
        ticket.priorite = request.data.get("priorite", ticket.priorite)
        ticket.dept_assigne = request.data.get("dept_assigne", ticket.dept_assigne)
        ticket.statut = Ticket.QUALIFIE
        ticket.save()
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def request_approval(self, request, pk=None):
        """Demande d'aval au chef du département assigné (SPEC §7.4)."""
        ticket = self.get_object()
        approval = TicketApproval.objects.create(
            ticket=ticket, demandeur=request.user, reponse_proposee=request.data.get("reponse_proposee", "")
        )
        ticket.statut = Ticket.ATTENTE_AVAL
        ticket.save()
        return Response(TicketApprovalSerializer(approval).data, status=201)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None, approval_pk=None):
        """Le chef approuve / modifie la réponse proposée (SPEC §7.5)."""
        ticket = self.get_object()
        approval = ticket.approvals.order_by("-cree_le").first()
        if not approval:
            return Response({"detail": "Aucune demande d'aval."}, status=400)
        approval.valideur = request.user
        approval.decision = request.data.get("decision", "approuve")
        approval.commentaire = request.data.get("commentaire", "")
        if request.data.get("reponse_proposee"):
            approval.reponse_proposee = request.data["reponse_proposee"]
        approval.save()
        ticket.statut = Ticket.APPROUVE
        ticket.save()
        return Response(TicketApprovalSerializer(approval).data)

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        """Secrétariat seul répond au client (SPEC §7.6)."""
        ticket = self.get_object()
        if ticket.statut not in (Ticket.APPROUVE, Ticket.QUALIFIE):
            return Response({"detail": "Aval requis avant réponse."}, status=400)
        TicketMessage.objects.create(ticket=ticket, auteur=request.user, is_internal=False,
                                     message=request.data.get("message", ""))
        ticket.statut = Ticket.REPONDU
        ticket.save()
        from apps.mailing.services import send_templated_mail

        send_templated_mail(
            "reponse_ticket", ticket.client.email,
            {"societe": ticket.client.nom_societe, "numero": ticket.numero,
             "sujet": ticket.sujet, "message": request.data.get("message", "")},
            client=ticket.client, ticket=ticket,
        )
        return Response(TicketSerializer(ticket).data)


class CourrierViewSet(viewsets.ModelViewSet):
    queryset = Courrier.objects.all()
    serializer_class = CourrierSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["sens", "statut"]
    search_fields = ["reference", "objet", "expediteur", "destinataire"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "admin"):
            return Response({"detail": "Suppression réservée au Secrétariat."}, status=403)
        obj = self.get_object()
        if obj.statut != Courrier.STATUT_BROUILLON:
            return Response({"detail": "Seul un courrier brouillon peut être supprimé."}, status=400)
        return super().destroy(request, *args, **kwargs)


class DechargeViewSet(viewsets.ModelViewSet):
    """Registre des décharges : scan compressé serveur + provenance + date."""

    queryset = Decharge.objects.all()
    serializer_class = DechargeSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["reference", "provenance", "objet"]
    filterset_fields = ["date_recue"]
    http_method_names = ["get", "post", "delete"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "admin"):
            return Response({"detail": "Suppression réservée au Secrétariat."}, status=403)
        obj = self.get_object()
        if obj.image:
            obj.image.delete(save=False)
        return super().destroy(request, *args, **kwargs)


class ReunionViewSet(viewsets.ModelViewSet):
    queryset = Reunion.objects.prefetch_related("decisions").all()
    serializer_class = ReunionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["statut"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "admin"):
            return Response({"detail": "Suppression réservée au Secrétariat."}, status=403)
        obj = self.get_object()
        if obj.statut != Reunion.PLANIFIEE:
            return Response({"detail": "Seule une réunion planifiée peut être supprimée."}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def decider(self, request, pk=None):
        """Ajoute une décision (PV en rédaction uniquement, SPEC §5.2)."""
        reunion = self.get_object()
        if reunion.statut != Reunion.PV_REDACTION:
            return Response({"detail": "Décisions possibles en statut 'PV en rédaction' uniquement."}, status=400)
        ser = DecisionSerializer(data={**request.data, "reunion": reunion.id})
        ser.is_valid(raise_exception=True)
        return Response(DecisionSerializer(ser.save()).data, status=201)

    @action(detail=True, methods=["post"], url_path="decisions/(?P<dec_id>[^/.]+)/convertir")
    def convertir_decision(self, request, pk=None, dec_id=None):
        """Décision -> tâche Kanban assignée (SPEC §5.2.4)."""
        reunion = self.get_object()
        decision = reunion.decisions.get(id=dec_id)
        if decision.tache:
            return Response({"detail": "Déjà convertie."}, status=400)
        project_id = request.data.get("project_id")
        if not project_id:
            return Response({"detail": "project_id requis."}, status=400)
        tache = Task.objects.create(project_id=project_id, titre=decision.texte,
                                    statut=Task.STATUT_A_FAIRE, assigne=decision.responsable)
        decision.tache = tache
        decision.save()
        return Response(DecisionSerializer(decision).data, status=201)
