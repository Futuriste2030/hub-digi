"""Transverse — SPEC §5.1/§10 : notifications in-app + dashboard super-admin (KPI)."""

from django.db.models import Count, Sum
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin

from .models import DirectMessage, GroupeChat, Notification, SiteSettings


class GroupeChatSerializer(serializers.ModelSerializer):
    membres_emails = serializers.SerializerMethodField()

    class Meta:
        model = GroupeChat
        fields = ["id", "nom", "general", "membres", "membres_emails", "cree_le"]
        read_only_fields = ["membres_emails"]

    def get_membres_emails(self, obj):
        if obj.general:
            return ["Tout le monde"]
        return list(obj.membres.order_by("email").values_list("email", flat=True)[:50])


def _groupes_visibles(user):
    """Groupes visibles : général + dont je suis membre (tout pour super_admin)."""
    from django.db.models import Q

    if user.role == "super_admin":
        return GroupeChat.objects.prefetch_related("membres").all()
    return GroupeChat.objects.prefetch_related("membres").filter(
        Q(general=True) | Q(membres=user)).distinct()


class GroupesChatView(APIView):
    """Groupes visibles : membres + général (+ tout pour super_admin).
    Création/suppression : super_admin uniquement (Paramètres > Chat)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(GroupeChatSerializer(_groupes_visibles(request.user), many=True).data)

    def post(self, request):
        from apps.accounts.models import User

        if request.user.role != "super_admin":
            return Response({"detail": "Création réservée au Super Admin."}, status=403)
        nom = (request.data.get("nom") or "").strip()
        if len(nom) < 2:
            return Response({"detail": "Nom de groupe requis (2 caractères minimum)."}, status=400)
        if GroupeChat.objects.filter(nom__iexact=nom).exists():
            return Response({"detail": "Un groupe porte déjà ce nom."}, status=400)
        general = bool(request.data.get("general"))
        groupe = GroupeChat.objects.create(nom=nom, general=general, cree_par=request.user)
        if not general:
            if request.data.get("tous"):
                membres = User.objects.exclude(role__in=["client", "super_admin"])
            else:
                ids = request.data.get("membres") or []
                membres = User.objects.exclude(role__in=["client", "super_admin"]).filter(id__in=ids)
            groupe.membres.set(membres)
        return Response(GroupeChatSerializer(groupe).data, status=201)

    def delete(self, request, pk=None):
        if request.user.role != "super_admin":
            return Response({"detail": "Suppression réservée au Super Admin."}, status=403)
        try:
            groupe = GroupeChat.objects.get(id=pk)
        except (GroupeChat.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Groupe introuvable."}, status=404)
        groupe.delete()
        return Response(status=204)


class MessagesGroupeView(APIView):
    """Historique (50 derniers) + envoi dans un groupe (membres uniquement)."""

    permission_classes = [IsAuthenticated]

    def _groupe(self, request, pk):
        try:
            groupe = GroupeChat.objects.get(id=pk)
        except (GroupeChat.DoesNotExist, ValueError, TypeError):
            return None, Response({"detail": "Groupe introuvable."}, status=404)
        if not groupe.est_membre(request.user):
            return None, Response({"detail": "Réservé aux membres du groupe."}, status=403)
        return groupe, None

    def get(self, request, pk=None):
        groupe, erreur = self._groupe(request, pk)
        if erreur:
            return erreur
        msgs = groupe.messages.select_related("expediteur").order_by("-cree_le")[:50]
        return Response(DirectMessageSerializer(reversed(list(msgs)), many=True).data)

    def post(self, request, pk=None):
        groupe, erreur = self._groupe(request, pk)
        if erreur:
            return erreur
        texte = (request.data.get("texte") or "").strip()
        if not texte:
            return Response({"detail": "Message vide."}, status=400)
        m = DirectMessage.objects.create(expediteur=request.user, destinataire=None,
                                         groupe=groupe, texte=texte[:2000])
        return Response(DirectMessageSerializer(m).data, status=201)


class MarquerGroupeLusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            groupe = GroupeChat.objects.get(id=pk)
        except (GroupeChat.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Groupe introuvable."}, status=404)
        if not groupe.est_membre(request.user):
            return Response({"detail": "Réservé aux membres du groupe."}, status=403)
        n = groupe.messages.exclude(expediteur=request.user).filter(lu=False).update(lu=True)
        return Response({"marques": n})


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "titre", "texte", "lue", "cree_le"]


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(destinataire=self.request.user)


class DirectMessageSerializer(serializers.ModelSerializer):
    expediteur_email = serializers.CharField(source="expediteur.email", read_only=True)

    class Meta:
        model = DirectMessage
        fields = ["id", "expediteur", "expediteur_email", "destinataire", "groupe", "texte", "lu", "cree_le"]
        read_only_fields = ["expediteur"]


class ConversationsView(APIView):
    """Dernier message par interlocuteur + non-lus (cloche Messages)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q

        from apps.accounts.models import User

        user = request.user
        msgs = DirectMessage.objects.filter(Q(expediteur=user) | Q(destinataire=user)).select_related(
            "expediteur", "destinataire").order_by("-cree_le")[:200]
        convos = {}
        for m in msgs:
            autre = m.destinataire if m.expediteur_id == user.id else m.expediteur
            if autre.id not in convos:
                convos[autre.id] = {"user": {"id": autre.id, "email": autre.email},
                                    "dernier": DirectMessageSerializer(m).data, "non_lus": 0}
        non_lus = DirectMessage.objects.filter(destinataire=user, lu=False).values("expediteur").annotate(
            n=Count("id"))
        for row in non_lus:
            if row["expediteur"] in convos:
                convos[row["expediteur"]]["non_lus"] = row["n"]
        return Response(sorted(convos.values(), key=lambda c: c["dernier"]["cree_le"], reverse=True))


class FilDiscussionView(APIView):
    """Historique avec un interlocuteur (50 derniers, ordre chrono)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q

        autre = request.query_params.get("avec")
        if not autre:
            return Response({"detail": "Paramètre ?avec= requis."}, status=400)
        user = request.user
        msgs = DirectMessage.objects.filter(
            Q(expediteur=user, destinataire_id=autre) | Q(expediteur_id=autre, destinataire=user)
        ).order_by("-cree_le")[:50]
        return Response(DirectMessageSerializer(reversed(list(msgs)), many=True).data)


class EnvoyerMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.models import User

        try:
            dest = User.objects.exclude(role="client").get(id=request.data.get("destinataire"))
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Destinataire invalide."}, status=400)
        if not (request.data.get("texte") or "").strip():
            return Response({"detail": "Message vide."}, status=400)
        m = DirectMessage.objects.create(expediteur=request.user, destinataire=dest,
                                         texte=request.data["texte"].strip()[:2000])
        return Response(DirectMessageSerializer(m).data, status=201)


class MarquerLusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        autre = request.data.get("avec")
        if not autre:
            return Response({"detail": "Paramètre avec requis."}, status=400)
        n = DirectMessage.objects.filter(expediteur_id=autre, destinataire=request.user, lu=False).update(lu=True)
        return Response({"marques": n})


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ["raison", "nif", "rccm", "adresse", "phone", "email", "delai_paiement", "signataire",
                  "cachet_finance", "signature_finance", "cachet_juridique", "signature_juridique",
                  "cachet_secretariat"]


class SiteSettingsView(APIView):
    """Lecture interne, écriture super_admin uniquement."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.instance()).data)

    def patch(self, request):
        if request.user.role != "super_admin":
            return Response({"detail": "Réservé Super Admin."}, status=403)
        obj = SiteSettings.instance()
        for champ in ("cachet_finance", "signature_finance", "cachet_juridique", "signature_juridique",
                        "cachet_secretariat"):
            fichier = request.FILES.get(champ)
            if fichier:
                if not fichier.content_type.startswith("image/"):
                    return Response({champ: "Image uniquement (PNG, JPG, WebP)."}, status=400)
                if fichier.size > 2 * 1024 * 1024:
                    return Response({champ: "2 Mo maximum."}, status=400)
        ser = SiteSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class DashboardSuperAdminView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from apps.bugtracker.models import BugReport
        from apps.clients.models import Client
        from apps.finance.models import Invoice
        from apps.projects_dev.models import Project
        from apps.rh.models import Employee
        from apps.secretariat_tickets.models import Ticket

        # Somme des totaux (montant × quantité), pas des prix unitaires :
        # Sum("lignes__montant") ignorerait les quantités et fausserait le CA.
        ca = sum((f.total for f in Invoice.objects.filter(statut=Invoice.STATUT_PAYEE).prefetch_related("lignes")), 0)
        from apps.finance.models import Expense

        depenses = Expense.objects.aggregate(s=Sum("montant"))["s"] or 0
        return Response(
            {
                "ca_paye": float(ca),
                "depenses_total": float(depenses),
                "ca_net": float(ca) - float(depenses),
                "projets_en_retard": Project.objects.exclude(statut=Project.STATUT_TERMINE).count(),
                "projets_actifs": Project.objects.exclude(statut__in=[Project.STATUT_TERMINE]).count(),
                "tickets_ouverts": Ticket.objects.exclude(statut__in=[Ticket.CLOS, Ticket.REPONDU]).count(),
                "tickets_urgents": Ticket.objects.filter(priorite__in=["haute", "critique"]).exclude(
                    statut__in=[Ticket.CLOS, Ticket.REPONDU]).count(),
                "bugs_critiques": BugReport.objects.filter(gravite="critique").exclude(statut="corrige").count(),
                "effectif": Employee.objects.count(),
                "clients": Client.objects.count(),
                "factures_impayees": Invoice.objects.filter(statut=Invoice.STATUT_IMPAYEE).count(),
                "par_statut_tickets": list(Ticket.objects.values("statut").annotate(n=Count("id"))),
                "par_statut_projets": list(Project.objects.values("statut").annotate(n=Count("id"))),
            }
        )


class DashboardPersoView(APIView):
    """KPI scopés au connecté : tâches assignées, tickets de son département, congés, impayés, notifs."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.finance.models import Invoice
        from apps.projects_dev.models import Task
        from apps.rh.models import Leave
        from apps.secretariat_tickets.models import Ticket

        user = request.user
        taches = Task.objects.filter(assigne=user).exclude(statut=Task.STATUT_DONE)
        dept_nom = user.department.nom if user.department_id else ""
        tickets = Ticket.objects.filter(dept_assigne=dept_nom).exclude(statut__in=[Ticket.CLOS, Ticket.REPONDU]) if dept_nom else Ticket.objects.none()
        if user.role in ("super_admin", "admin", "chef_rh"):
            conges = Leave.objects.filter(statut=Leave.STATUT_ATTENTE).count()
        else:
            conges = Leave.objects.filter(employe__user=user, statut=Leave.STATUT_ATTENTE).count()
        if user.role in ("super_admin", "chef_finance", "membre_finance"):
            impayees = Invoice.objects.filter(statut=Invoice.STATUT_IMPAYEE)
        else:
            impayees = Invoice.objects.none()
        return Response(
            {
                "taches_assignees": taches.count(),
                "projets_suivis": taches.values("project").distinct().count(),
                "tickets_dept_ouverts": tickets.count(),
                "conges_en_attente": conges,
                "factures_impayees": impayees.count(),
                "notifs_non_lues": Notification.objects.filter(destinataire=user, lue=False).count(),
            }
        )


class SeriesView(APIView):
    """Séries 12 derniers mois : encaissements (reçus) + projets créés. Super_admin et internes."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date

        from django.db.models.functions import TruncMonth

        from apps.finance.models import Expense, Receipt
        from apps.projects_dev.models import Project

        mois, labels = [], []
        today = date.today()
        for i in range(11, -1, -1):
            m = (today.month - i - 1) % 12 + 1
            a = today.year - (1 if today.month - i - 1 < 0 else 0)
            mois.append((a, m))
        noms = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
        labels = [f"{noms[m - 1]} {a % 100:02d}" for a, m in mois]

        enc = {(x["mois"].year, x["mois"].month): float(x["s"] or 0) for x in
               Receipt.objects.annotate(mois=TruncMonth("cree_le")).values("mois").annotate(s=Sum("montant"))}
        prj = {(x["mois"].year, x["mois"].month): x["n"] for x in
               Project.objects.annotate(mois=TruncMonth("cree_le")).values("mois").annotate(n=Count("id"))}
        dep = {(x["mois"].year, x["mois"].month): float(x["s"] or 0) for x in
               Expense.objects.annotate(mois=TruncMonth("date")).values("mois").annotate(s=Sum("montant"))}
        return Response({
            "labels": labels,
            "encaissements": [enc.get(k, 0) for k in mois],
            "depenses": [dep.get(k, 0) for k in mois],
            "projets": [prj.get(k, 0) for k in mois],
        })
