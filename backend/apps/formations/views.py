"""Formations API — soumissions vitrine -> inscription + facture brouillon.

Webhook public `POST /api/v1/formations/inscriptions/` (token X-Hub-Token,
throttle 60/min, miroir candidatures) : déduplication email + formation,
création auto Formation (slug), Participant, Inscription puis Invoice
brouillon (ligne = prix formation). Rien n'est envoyé : le clic WhatsApp
(passe en envoyée) et l'encaissement (`payer()` -> reçu auto) sont manuels.
"""

from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.utils.crypto import constant_time_compare

from apps.finance.models import Invoice, InvoiceLigne

from .models import Formation, InscriptionFormation, ParticipantFormation


def telephone_whatsapp(brut):
    """Normalise un numéro pour wa.me : chiffres seuls, +223 si local 8 chiffres."""
    chiffres = "".join(c for c in str(brut or "") if c.isdigit())
    if len(chiffres) == 8:
        return f"223{chiffres}"
    if chiffres.startswith("223") and len(chiffres) == 11:
        return chiffres
    return chiffres


def message_whatsapp(invoice):
    """Message prêt à envoyer : inscription confirmée + facture + montant (+ lien pay si actif)."""
    from django.conf import settings

    insc = invoice.inscription
    prenom = (insc.participant.full_name or "").split()[0] if insc and insc.participant else ""
    titre = insc.formation.titre if insc else ""
    total = f"{float(invoice.total or 0):,.0f}".replace(",", " ")
    texte = (
        f"Bonjour {prenom}, votre inscription à la formation « {titre} » est confirmée. "
        f"Facture {invoice.numero} : {total} F à régler. Présentez ce message le jour J. "
        "Digi Com & Technologies."
    )
    if getattr(settings, "PAYMENT_ENABLED", False):
        base = getattr(settings, "PAYMENT_URL", "https://pay.digicom.ml").rstrip("/")
        texte += f" Payez ici : {base}/f/{invoice.numero}"
    return texte


class FormationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Formation
        fields = ["id", "slug", "titre", "prix", "duree", "active", "cree_le"]


class InscriptionSerializer(serializers.ModelSerializer):
    formation_titre = serializers.CharField(source="formation.titre", read_only=True)
    formation_prix = serializers.IntegerField(source="formation.prix", read_only=True)
    participant_nom = serializers.CharField(source="participant.full_name", read_only=True)
    participant_email = serializers.CharField(source="participant.email", read_only=True)
    participant_telephone = serializers.CharField(source="participant.phone", read_only=True)
    facture_id = serializers.SerializerMethodField()
    facture_numero = serializers.SerializerMethodField()
    facture_statut = serializers.SerializerMethodField()
    facture_total = serializers.SerializerMethodField()
    facture_paye = serializers.SerializerMethodField()
    facture_solde = serializers.SerializerMethodField()

    class Meta:
        model = InscriptionFormation
        fields = ["id", "formation", "formation_titre", "formation_prix",
                  "participant_nom", "participant_email", "participant_telephone",
                  "reference", "statut", "message", "reference_site",
                  "facture_id", "facture_numero", "facture_statut",
                  "facture_total", "facture_paye", "facture_solde", "cree_le"]

    def _facture(self, obj):
        return obj.factures.order_by("-cree_le").first()

    def get_facture_id(self, obj):
        f = self._facture(obj)
        return f.id if f else None

    def get_facture_numero(self, obj):
        f = self._facture(obj)
        return f.numero if f else ""

    def get_facture_statut(self, obj):
        f = self._facture(obj)
        return f.statut if f else ""

    def get_facture_total(self, obj):
        f = self._facture(obj)
        return float(f.total or 0) if f else 0

    def get_facture_paye(self, obj):
        f = self._facture(obj)
        return float(f.paye or 0) if f else 0

    def get_facture_solde(self, obj):
        f = self._facture(obj)
        return float(f.solde or 0) if f else 0


class FormationViewSet(viewsets.ModelViewSet):
    queryset = Formation.objects.all()
    serializer_class = FormationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["active"]
    search_fields = ["slug", "titre"]


class InscriptionViewSet(viewsets.ModelViewSet):
    queryset = (InscriptionFormation.objects.select_related("formation", "participant")
                .prefetch_related("factures__lignes", "factures__recus").all())
    serializer_class = InscriptionSerializer
    filterset_fields = ["formation", "statut"]
    search_fields = ["reference", "participant__full_name", "participant__email",
                     "participant__phone", "formation__titre"]

    def get_permissions(self):
        # Webhook vitrine : POST public (token vérifié dans create), reste authentifié.
        if self.action == "create":
            return []
        return [IsAuthenticated()]

    def get_throttles(self):
        if self.action == "create":
            return [ScopedRateThrottle()]
        return super().get_throttles()

    throttle_scope = "webhook"

    def create(self, request, *args, **kwargs):
        """Soumission vitrine (publique) : dédup email+formation, facture brouillon auto."""
        token = request.headers.get("X-Hub-Token", "")
        if not settings.CAREER_WEBHOOK_TOKEN or not constant_time_compare(token, settings.CAREER_WEBHOOK_TOKEN):
            return Response({"detail": "refusé"}, status=403)
        data = request.data
        slug = (data.get("formation_reference") or "").strip()
        email = (data.get("email") or "").strip()
        nom = (data.get("nom") or "").strip()
        if not slug or not email or "@" not in email or not nom:
            return Response({"detail": "formation_reference + nom + email valides requis."}, status=400)
        formation, _ = Formation.objects.get_or_create(
            slug=slugify(slug) or slug,
            defaults={"titre": data.get("formation_titre") or slug,
                      "prix": int(data.get("formation_prix") or 0)},
        )
        participant, _ = ParticipantFormation.objects.get_or_create(
            email=email,
            defaults={"full_name": nom, "phone": data.get("telephone", "")},
        )
        inscription, creee = InscriptionFormation.objects.get_or_create(
            formation=formation, participant=participant,
            defaults={"message": data.get("message", ""),
                      "reference_site": data.get("reference_site", "")},
        )
        if not creee:
            return Response(InscriptionSerializer(inscription).data
                            | {"doublon": True}, status=200)
        facture = Invoice.objects.create(client=None, inscription=inscription,
                                         statut=Invoice.STATUT_BROUILLON)
        InvoiceLigne.objects.create(
            invoice=facture,
            description=f"Formation : {formation.titre}",
            quantite=1,
            montant=formation.prix,
        )
        return Response(InscriptionSerializer(inscription).data
                        | {"facture_numero": facture.numero}, status=201)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Pilotage : facturé / encaissé / reste, global + par formation."""
        from django.db.models import Sum

        factures = Invoice.objects.filter(inscription__isnull=False).prefetch_related("recus", "lignes")
        total_facture = sum(float(f.total or 0) for f in factures)
        total_encaisse = sum(float(f.paye or 0) for f in factures)
        par_formation = []
        for formation in Formation.objects.filter(active=True).order_by("titre"):
            fs = [f for f in factures if f.inscription.formation_id == formation.id]
            par_formation.append({
                "formation": formation.titre,
                "slug": formation.slug,
                "inscriptions": formation.inscriptions.count(),
                "facture": sum(float(f.total or 0) for f in fs),
                "encaisse": sum(float(f.paye or 0) for f in fs),
            })
        return Response({
            "total_facture": total_facture,
            "total_encaisse": total_encaisse,
            "reste": total_facture - total_encaisse,
            "par_formation": par_formation,
        })


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParticipantFormation
        fields = ["id", "full_name", "email", "phone", "cree_le"]


class ParticipantViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ParticipantFormation.objects.all()
    serializer_class = ParticipantSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["full_name", "email", "phone"]
