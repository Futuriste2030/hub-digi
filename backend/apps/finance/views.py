"""Finance API — SPEC §5.7/§12 : quotes/invoices/receipts/expenses + pdf/send/validate/pay."""

from django.conf import settings as dj_settings
from django.http import FileResponse
from django.utils.crypto import constant_time_compare
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Devis, DevisLigne, Expense, FichePaie, Invoice, InvoiceLigne, LignePaie, Receipt
from .pdf import pdf_devis, pdf_facture, pdf_recu


class LigneSerializer(serializers.Serializer):
    description = serializers.CharField()
    quantite = serializers.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = serializers.DecimalField(max_digits=12, decimal_places=2)


class DevisSerializer(serializers.ModelSerializer):
    total = serializers.ReadOnlyField()
    lignes = LigneSerializer(many=True, required=False)
    client_nom = serializers.CharField(source="client.nom_societe", read_only=True)
    client_email = serializers.CharField(source="client.email", read_only=True)
    client_adresse = serializers.CharField(source="client.adresse", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)

    class Meta:
        model = Devis
        fields = ["id", "client", "client_nom", "client_email", "client_adresse", "client_phone",
                  "project", "numero", "objet", "validite", "statut", "total", "lignes", "cree_le"]
        read_only_fields = ["numero"]

    def create(self, validated_data):
        lignes = validated_data.pop("lignes", [])
        devis = Devis.objects.create(**validated_data)
        for l in lignes:
            DevisLigne.objects.create(devis=devis, **l)
        return devis


class InvoiceSerializer(serializers.ModelSerializer):
    total = serializers.ReadOnlyField()
    paye = serializers.ReadOnlyField()
    solde = serializers.ReadOnlyField()
    lignes = LigneSerializer(many=True, required=False)
    client_nom = serializers.SerializerMethodField()
    client_email = serializers.SerializerMethodField()
    client_adresse = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()
    project_titre = serializers.CharField(source="project.titre", read_only=True)
    formation_titre = serializers.CharField(source="inscription.formation.titre", read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "client", "inscription", "client_nom", "client_email", "client_adresse",
                  "client_phone", "formation_titre", "project", "project_titre", "numero",
                  "type_doc", "tva_active", "statut", "envoyee_le", "total", "paye", "solde",
                  "lignes", "cree_le"]
        read_only_fields = ["numero", "envoyee_le"]

    def get_client_nom(self, obj):
        return obj.destinataire_nom

    def get_client_email(self, obj):
        return obj.destinataire_email

    def get_client_adresse(self, obj):
        return obj.client.adresse if obj.client_id else ""

    def get_client_phone(self, obj):
        return obj.destinataire_phone

    def create(self, validated_data):
        lignes = validated_data.pop("lignes", [])
        invoice = Invoice(**validated_data)
        invoice.save()  # génère FACTURE-SLUGCLIENT-JJ-MM-AAAA-ID
        for l in lignes:
            InvoiceLigne.objects.create(invoice=invoice, **l)
        return invoice


class ReceiptSerializer(serializers.ModelSerializer):
    facture_numero = serializers.CharField(source="invoice.numero", read_only=True)
    client_nom = serializers.SerializerMethodField()
    client_email = serializers.SerializerMethodField()
    client_adresse = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = ["id", "invoice", "facture_numero", "client_nom", "client_email",
                  "client_adresse", "client_phone", "numero", "montant", "moyen",
                  "ref_transaction", "cree_le"]
        read_only_fields = ["numero"]

    def get_client_nom(self, obj):
        return obj.invoice.destinataire_nom

    def get_client_email(self, obj):
        return obj.invoice.destinataire_email

    def get_client_adresse(self, obj):
        return obj.invoice.client.adresse if obj.invoice.client_id else ""

    def get_client_phone(self, obj):
        return obj.invoice.destinataire_phone


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ["id", "libelle", "departement", "montant", "moyen", "date", "cree_le"]


class FinanceScopeMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(client_id=user.client_id)
        client_id = self.request.query_params.get("client_id")
        if client_id and hasattr(self.queryset.model, "client"):
            qs = qs.filter(client_id=client_id)
        return qs


class DevisViewSet(FinanceScopeMixin, viewsets.ModelViewSet):
    queryset = Devis.objects.select_related("client").prefetch_related("lignes").all()
    serializer_class = DevisSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "statut"]
    search_fields = ["numero", "objet"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        devis = self.get_object()
        return FileResponse(pdf_devis(devis), as_attachment=True, filename=f"{devis.numero or f'devis-{devis.pk}'}.pdf")

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """Client valide son devis -> converti en facture (SPEC §6)."""
        devis = self.get_object()
        if devis.statut != Devis.STATUT_ATTENTE:
            return Response({"detail": "Devis déjà traité."}, status=400)
        devis.statut = Devis.STATUT_ACCEPTE
        devis.save()
        invoice = Invoice.objects.create(client=devis.client, project=devis.project, statut=Invoice.STATUT_VALIDEE)
        for l in devis.lignes.all():
            InvoiceLigne.objects.create(invoice=invoice, description=l.description, quantite=l.quantite, montant=l.montant)
        return Response(InvoiceSerializer(invoice).data, status=201)

    @action(detail=True, methods=["post"])
    def rejeter(self, request, pk=None):
        devis = self.get_object()
        devis.statut = Devis.STATUT_REFUSE
        devis.save()
        return Response(DevisSerializer(devis).data)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        obj = self.get_object()
        if obj.statut == Devis.STATUT_ACCEPTE:
            return Response({"detail": "Devis accepté (facture créée) : suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)


class InvoiceViewSet(FinanceScopeMixin, viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("client", "inscription__formation",
                                              "inscription__participant").prefetch_related("lignes", "recus").all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["client", "statut", "type_doc"]
    search_fields = ["numero"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        invoice = self.get_object()
        return FileResponse(pdf_facture(invoice), as_attachment=True, filename=f"{invoice.numero}.pdf")

    @action(detail=True, methods=["post"])
    def payer(self, request, pk=None):
        """Enregistre un paiement -> reçu auto (SPEC §5.7)."""
        invoice = self.get_object()
        # Champs explicites (pas de **request.data : multipart = listes).
        ser = ReceiptSerializer(data={
            "invoice": invoice.id,
            "montant": request.data.get("montant"),
            "moyen": request.data.get("moyen", Receipt.MOYEN_ESPECES),
            "ref_transaction": request.data.get("ref_transaction", ""),
        })
        ser.is_valid(raise_exception=True)
        recu = ser.save()
        # Relecture sans cache prefetch (recus créés à l'instant) pour solde exact.
        invoice = Invoice.objects.prefetch_related("lignes", "recus").get(id=invoice.id)
        invoice.statut = Invoice.STATUT_PAYEE if invoice.solde <= 0 else Invoice.STATUT_PARTIELLE
        invoice.save()
        from apps.mailing.services import send_templated_mail

        send_templated_mail(
            "recu_disponible", invoice.destinataire_email,
            {"societe": invoice.destinataire_nom, "numero": recu.numero,
             "montant": f"{float(recu.montant):,.0f}".replace(",", " "),
             "facture_numero": invoice.numero},
            department_slug="finance", client=invoice.client,
        )
        return Response(ReceiptSerializer(recu).data, status=201)

    @action(detail=True, methods=["post"])
    def whatsapp(self, request, pk=None):
        """Envoi facture formation via WhatsApp : brouillon -> envoyée (+ envoyee_le).

        Retourne le numéro international + le message prêt (le front ouvre wa.me).
        Réservé aux factures liées à une inscription formation (client NULL)."""
        from apps.formations.views import message_whatsapp, telephone_whatsapp

        invoice = self.get_object()
        if invoice.inscription_id is None:
            return Response({"detail": "WhatsApp réservé aux factures formations."}, status=400)
        telephone = telephone_whatsapp(invoice.destinataire_phone)
        if not telephone:
            return Response({"detail": "Téléphone participant manquant."}, status=400)
        if invoice.statut == Invoice.STATUT_BROUILLON:
            from django.utils import timezone

            invoice.statut = Invoice.STATUT_ENVOYEE
            invoice.envoyee_le = timezone.now()
            invoice.save(update_fields=["statut", "envoyee_le"])
        return Response({
            "telephone": telephone,
            "message": message_whatsapp(invoice),
            "statut": invoice.statut,
            "envoyee_le": invoice.envoyee_le,
        })

    @action(detail=True, methods=["post"])
    def envoyer(self, request, pk=None):
        invoice = self.get_object()
        if invoice.client_id is None:
            return Response({"detail": "Facture formation : utilisez l'envoi WhatsApp."}, status=400)
        if invoice.statut == Invoice.STATUT_BROUILLON:
            invoice.statut = Invoice.STATUT_VALIDEE
        invoice.statut = Invoice.STATUT_ENVOYEE if invoice.statut == Invoice.STATUT_VALIDEE else invoice.statut
        if invoice.envoyee_le is None and invoice.statut == Invoice.STATUT_ENVOYEE:
            from django.utils import timezone

            invoice.envoyee_le = timezone.now()
        invoice.save()
        from django.conf import settings

        from apps.mailing.services import send_templated_mail

        url_espace = f"{settings.FRONTEND_URL}/espace"
        if invoice.client.slug and invoice.client.code:
            url_espace = f"{url_espace}/{invoice.client.slug}/{invoice.client.code}"
        send_templated_mail(
            "facture_disponible", invoice.client.email,
            {"societe": invoice.client.nom_societe, "numero": invoice.numero,
             "total": f"{float(invoice.total):,.0f}".replace(",", " "),
             "espace_url": url_espace},
            department_slug="finance", client=invoice.client,
        )
        return Response(InvoiceSerializer(invoice).data)


class PayWebhookView(APIView):
    """Confirmation de paiement pay.digicom.ml -> reçu auto (public, token, throttle).

    Payload : {facture_numero, montant, ref_transaction, moyen?}.
    Idempotent : même ref_transaction -> 200 doublon, jamais 2 reçus.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def post(self, request):
        token = request.headers.get("X-Hub-Token", "")
        if not dj_settings.CAREER_WEBHOOK_TOKEN or not constant_time_compare(token, dj_settings.CAREER_WEBHOOK_TOKEN):
            return Response({"detail": "refusé"}, status=403)
        numero = (request.data.get("facture_numero") or "").strip()
        ref = (request.data.get("ref_transaction") or "").strip()
        try:
            montant = float(request.data.get("montant") or 0)
        except (TypeError, ValueError):
            montant = 0
        if not numero or not ref or montant <= 0:
            return Response({"detail": "facture_numero + montant > 0 + ref_transaction requis."}, status=400)
        try:
            invoice = Invoice.objects.prefetch_related("lignes", "recus").get(numero=numero)
        except Invoice.DoesNotExist:
            return Response({"detail": "Facture introuvable."}, status=404)
        existant = Receipt.objects.filter(ref_transaction=ref).first()
        if existant:
            return Response({"id": existant.id, "numero": existant.numero, "doublon": True}, status=200)
        moyen = request.data.get("moyen") or Receipt.MOYEN_MOBILE_MONEY
        if moyen not in dict(Receipt.MOYENS):
            moyen = Receipt.MOYEN_MOBILE_MONEY
        recu = Receipt.objects.create(invoice=invoice, montant=montant, moyen=moyen,
                                      ref_transaction=ref)
        invoice = Invoice.objects.prefetch_related("lignes", "recus").get(id=invoice.id)
        invoice.statut = Invoice.STATUT_PAYEE if invoice.solde <= 0 else Invoice.STATUT_PARTIELLE
        invoice.save()
        from apps.mailing.services import send_templated_mail

        send_templated_mail(
            "recu_disponible", invoice.destinataire_email,
            {"societe": invoice.destinataire_nom, "numero": recu.numero,
             "montant": f"{float(recu.montant):,.0f}".replace(",", " "),
             "facture_numero": invoice.numero},
            department_slug="finance", client=invoice.client,
        )
        return Response({"id": recu.id, "numero": recu.numero,
                         "statut_facture": invoice.statut}, status=201)


class ReceiptViewSet(viewsets.ModelViewSet):
    queryset = Receipt.objects.select_related("invoice").all()
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["invoice", "moyen"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            return qs.filter(invoice__client_id=user.client_id)
        return qs

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        recu = self.get_object()
        return FileResponse(pdf_recu(recu), as_attachment=True, filename=f"{recu.numero}.pdf")


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["departement", "moyen"]
    search_fields = ["libelle"]

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        return super().destroy(request, *args, **kwargs)


class LignePaieSerializer(serializers.ModelSerializer):
    class Meta:
        model = LignePaie
        fields = ["id", "numero", "departement", "prenom", "nom", "fonction", "montant", "statut", "date"]


class FichePaieSerializer(serializers.ModelSerializer):
    lignes = LignePaieSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = FichePaie
        fields = ["id", "mois_idx", "annee", "statut", "cachet", "lignes", "total", "cree_le"]
        read_only_fields = ["cachet"]

    def get_total(self, obj):
        return float(sum((l.montant or 0) for l in obj.lignes.all()))


class FichePaieViewSet(viewsets.ModelViewSet):
    queryset = FichePaie.objects.prefetch_related("lignes").all()
    serializer_class = FichePaieSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["annee", "statut"]

    def destroy(self, request, *args, **kwargs):
        # Paie sensible : chef_finance / super_admin seuls, brouillon uniquement.
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        fiche = self.get_object()
        if fiche.statut == FichePaie.STATUT_CLOTUREE:
            return Response({"detail": "Fiche clôturée : suppression impossible (archive légale)."}, status=400)
        if fiche.lignes.filter(statut=LignePaie.STATUT_PAYE).exists():
            return Response({"detail": "Fiche avec lignes payées : suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def ajouter_ligne(self, request, pk=None):
        fiche = self.get_object()
        if fiche.statut == FichePaie.STATUT_CLOTUREE:
            return Response({"detail": "Fiche clôturée, lecture seule."}, status=400)
        ser = LignePaieSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(fiche=fiche)
        return Response(ser.data, status=201)

    @action(detail=True, methods=["patch"], url_path="lignes/(?P<numero>[^/.]+)")
    def maj_ligne(self, request, pk=None, numero=None):
        fiche = self.get_object()
        if fiche.statut == FichePaie.STATUT_CLOTUREE:
            return Response({"detail": "Fiche clôturée, lecture seule."}, status=400)
        try:
            ligne = fiche.lignes.get(numero=numero)
        except LignePaie.DoesNotExist:
            return Response({"detail": "Ligne introuvable."}, status=404)
        ser = LignePaieSerializer(ligne, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    @action(detail=True, methods=["post"])
    def cloturer(self, request, pk=None):
        fiche = self.get_object()
        if not fiche.cachet:
            return Response({"detail": "Cachet requis avant clôture."}, status=400)
        fiche.statut = FichePaie.STATUT_CLOTUREE
        fiche.save()
        return Response(FichePaieSerializer(fiche).data)

    @action(detail=True, methods=["post", "delete"])
    def cachet(self, request, pk=None):
        fiche = self.get_object()
        if request.method == "DELETE":
            if fiche.statut == FichePaie.STATUT_CLOTUREE:
                return Response({"detail": "Fiche clôturée, lecture seule."}, status=400)
            if request.user.role not in ("super_admin", "chef_finance"):
                return Response({"detail": "Retrait réservé au Chef Finance."}, status=403)
            if fiche.cachet:
                fiche.cachet.delete(save=False)
            fiche.cachet = None
            fiche.save()
            return Response(FichePaieSerializer(fiche).data)
        fichier = request.FILES.get("cachet")
        if not fichier:
            return Response({"detail": "Image requise."}, status=400)
        if not fichier.content_type.startswith("image/"):
            return Response({"detail": "Image uniquement (PNG, JPG, WebP)."}, status=400)
        if fichier.size > 2 * 1024 * 1024:
            return Response({"detail": "2 Mo maximum."}, status=400)
        fiche.cachet.save(fichier.name, fichier, save=True)
        return Response(FichePaieSerializer(fiche).data)
