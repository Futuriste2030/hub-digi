"""Formations API — soumissions vitrine -> inscription + facture brouillon.

Webhook public `POST /api/v1/formations/inscriptions/` (token X-Hub-Token,
throttle 60/min, miroir candidatures) : déduplication email + formation,
création auto Formation (slug), Participant, Inscription puis Invoice
brouillon (ligne = prix formation). Rien n'est envoyé : le clic WhatsApp
(passe en envoyée) et l'encaissement (`payer()` -> reçu auto) sont manuels.
"""

import zipfile
from io import BytesIO

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

from . import services
from .models import (AttestationFormation, Formation, InscriptionFormation,
                     ParticipantFormation)

# Rôles autorisés à délivrer des attestations (et à les télécharger).
ROLES_ATTESTATION = ("super_admin", "admin", "chef_finance", "membre_finance")


def _peut_delivrer(user):
    return getattr(user, "role", "") in ROLES_ATTESTATION


def _slug(nom):
    return slugify(nom or "") or "document"


def _statuts_demandes(brut):
    """Statuts d'inscription éligibles (liste séparée par virgules)."""
    if not brut:
        return services.STATUTS_DEFAUT
    if isinstance(brut, str):
        brut = [b.strip() for b in brut.split(",")]
    tous = [choix[0] for choix in InscriptionFormation.STATUTS]
    valides = tuple(s for s in tous if s in (brut or []))
    return valides or services.STATUTS_DEFAUT


def _date_demande(valeur):
    """Date de délivrance (ISO) ou None."""
    if not valeur:
        return None
    from datetime import date

    try:
        return date.fromisoformat(str(valeur)[:10])
    except (TypeError, ValueError):
        return None


def telephone_whatsapp(brut):
    """Normalise un numéro pour wa.me : chiffres seuls, +223 si local 8 chiffres."""
    chiffres = "".join(c for c in str(brut or "") if c.isdigit())
    if len(chiffres) == 8:
        return f"223{chiffres}"
    if chiffres.startswith("223") and len(chiffres) == 11:
        return chiffres
    return chiffres


def message_whatsapp(invoice):
    """Message prêt à envoyer : inscription confirmée + facture + montant.

    Pour une FORMATION, il n'y a pas de lien de paiement (le règlement se
    fait à l'agence, saisi manuellement via le bouton « Encaisser ») : on
    renvoie le message de confirmation + le montant, sans URL de paiement.
    """
    from apps.ligdicash.liens import lien_paiement_facture

    insc = invoice.inscription
    prenom = (insc.participant.full_name or "").split()[0] if insc and insc.participant else ""
    titre = insc.formation.titre if insc else ""
    total = f"{float(invoice.total or 0):,.0f}".replace(",", " ")
    if insc:
        paiement = " Règlement à l'agence (Digi Com & Technologies)."
    else:
        lien = lien_paiement_facture(invoice.numero)
        paiement = f" Payez ici : {lien}" if lien else ""
    return (
        f"Bonjour {prenom}, votre inscription à la formation « {titre} » est confirmée. "
        f"Facture {invoice.numero} : {total} F.{paiement} "
        "Digi Com & Technologies."
    )


class FormationSerializer(serializers.ModelSerializer):
    nb_inscriptions = serializers.IntegerField(source="inscriptions.count", read_only=True)

    class Meta:
        model = Formation
        fields = ["id", "slug", "titre", "prix", "duree", "date_debut", "date_fin", "lieu",
                  "departement", "active", "nb_inscriptions", "cree_le"]


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
    attestation_id = serializers.SerializerMethodField()
    attestation_numero = serializers.SerializerMethodField()
    attestation_lien = serializers.SerializerMethodField()

    class Meta:
        model = InscriptionFormation
        fields = ["id", "formation", "formation_titre", "formation_prix",
                  "participant_nom", "participant_email", "participant_telephone",
                  "reference", "statut", "message", "reference_site",
                  "facture_id", "facture_numero", "facture_statut",
                  "facture_total", "facture_paye", "facture_solde",
                  "attestation_id", "attestation_numero", "attestation_lien", "cree_le"]

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

    def _attestation(self, obj):
        return AttestationFormation.objects.filter(inscription=obj).first()

    def get_attestation_id(self, obj):
        a = self._attestation(obj)
        return a.id if a else None

    def get_attestation_numero(self, obj):
        a = self._attestation(obj)
        return a.numero if a else ""

    def get_attestation_lien(self, obj):
        from .liens import lien_verification_attestation

        a = self._attestation(obj)
        return lien_verification_attestation(a.numero) if a else ""


class AttestationSerializer(serializers.ModelSerializer):
    """Attestation de formation — expose le lien public de vérification (le QR)."""

    inscription_id = serializers.IntegerField(source="inscription.id", read_only=True)
    inscription_reference = serializers.CharField(source="inscription.reference", read_only=True)
    participant_nom = serializers.CharField(source="inscription.participant.full_name", read_only=True)
    participant_email = serializers.CharField(source="inscription.participant.email", read_only=True)
    formation_id = serializers.IntegerField(source="inscription.formation.id", read_only=True)
    formation_titre = serializers.CharField(source="inscription.formation.titre", read_only=True)
    formation_slug = serializers.CharField(source="inscription.formation.slug", read_only=True)
    lien_verification = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = AttestationFormation
        fields = ["id", "numero", "date_delivrance", "mention", "genere_le",
                  "inscription_id", "inscription_reference",
                  "participant_nom", "participant_email",
                  "formation_id", "formation_titre", "formation_slug",
                  "lien_verification", "pdf_url"]

    def get_lien_verification(self, obj):
        from .liens import lien_verification_attestation

        return lien_verification_attestation(obj.numero)

    def get_pdf_url(self, obj):
        return f"/api/v1/formations/attestations/{obj.id}/pdf/"


class FormationViewSet(viewsets.ModelViewSet):
    queryset = Formation.objects.all()
    serializer_class = FormationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["active"]
    search_fields = ["slug", "titre"]

    @action(detail=True, methods=["post"], url_path="attestations")
    def attestations(self, request, pk=None):
        """Génère les attestations de TOUTES les inscriptions éligibles.

        Body : {mention?, date_delivrance?, statuts?, force?}
        `statuts` = statuts d'inscription éligibles (défaut : « terminee »).
        `force` = met à jour la mention des attestations déjà émises.
        """
        formation = self.get_object()
        if not _peut_delivrer(request.user):
            return Response({"detail": "Délivrance d'attestations réservée à l'administration "
                                       "et à la finance."}, status=403)
        statuts = _statuts_demandes(request.data.get("statuts"))
        recap = services.generer_attestations_formation(
            formation,
            statuts=statuts,
            mention=(request.data.get("mention") or "").strip(),
            date_delivrance=_date_demande(request.data.get("date_delivrance")),
            force=bool(request.data.get("force")),
        )
        return Response({
            "formation": recap["formation"],
            "creees": [AttestationSerializer(a).data for a in recap["creees"]],
            "creees_nombre": len(recap["creees"]),
            "existantes": [AttestationSerializer(a).data for a in recap["existantes"]],
            "existantes_nombre": len(recap["existantes"]),
            "ignorees": recap["ignorees"],
            "ignorees_nombre": len(recap["ignorees"]),
        })

    @action(detail=True, methods=["get"], url_path="attestations/zip")
    def attestations_zip(self, request, pk=None):
        """ZIP des attestations de la formation (impression / distribution)."""
        formation = self.get_object()
        if not _peut_delivrer(request.user):
            return Response({"detail": "Téléchargement réservé à l'administration et à la finance."},
                            status=403)
        attestations = (AttestationFormation.objects
                        .filter(inscription__formation=formation)
                        .select_related("inscription__participant", "inscription__formation")
                        .order_by("inscription__participant__full_name"))
        if not attestations.exists():
            return Response({"detail": "Aucune attestation à télécharger pour cette formation."},
                            status=404)
        from django.http import FileResponse

        from .pdf import pdf_attestation

        tampon = BytesIO()
        with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as archive:
            for attestation in attestations:
                nom = f"{attestation.numero}_{_slug(attestation.inscription.participant.full_name)}.pdf"
                archive.writestr(nom, pdf_attestation(attestation).read())
        tampon.seek(0)
        nom_zip = f"attestations-{_slug(formation.titre)}.zip"
        return FileResponse(tampon, as_attachment=True, filename=nom_zip)


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

    @action(detail=True, methods=["post"], url_path="attestation")
    def attestation(self, request, pk=None):
        """Délivre (ou retourne) l'attestation de CETTE inscription.

        Body : {mention?, date_delivrance?, force?}
        """
        inscription = self.get_object()
        if not _peut_delivrer(request.user):
            return Response({"detail": "Délivrance d'attestations réservée à l'administration "
                                       "et à la finance."}, status=403)
        statuts = _statuts_demandes(request.data.get("statuts")) \
            if request.data.get("statuts") else services.STATUTS_DEFAUT
        if not services.eligible(inscription, statuts):
            return Response({
                "detail": f"Inscription en statut « {inscription.get_statut_display()} » : "
                          "non éligible à une attestation.",
            }, status=400)
        attestation, creee = services.generer_attestation(
            inscription,
            mention=(request.data.get("mention") or "").strip(),
            date_delivrance=_date_demande(request.data.get("date_delivrance")),
            force=bool(request.data.get("force")),
        )
        data = AttestationSerializer(attestation).data
        data["creee"] = creee
        return Response(data, status=201 if creee else 200)

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

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        inscription = self.get_object()
        payees = [f for f in inscription.factures.all()
                  if f.recus.exists()]
        if payees:
            return Response({"detail": "Inscription payée (reçu émis) : suppression impossible."},
                            status=400)
        # Factures non soldées liées : supprimées avec l'inscription (pas d'orphelines).
        for facture in inscription.factures.all():
            facture.delete()
        return super().destroy(request, *args, **kwargs)

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


class AttestationViewSet(viewsets.ReadOnlyModelViewSet):
    """Attestations délivrées — lecture (admin/finance) et téléchargement du PDF."""

    queryset = (AttestationFormation.objects
                .select_related("inscription__participant", "inscription__formation").all())
    serializer_class = AttestationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inscription__formation"]
    search_fields = ["numero", "inscription__participant__full_name",
                     "inscription__participant__email", "inscription__formation__titre"]

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """Télécharge le PDF de l'attestation (A4 paysage)."""
        from django.http import FileResponse

        from .pdf import pdf_attestation

        attestation = self.get_object()
        return FileResponse(pdf_attestation(attestation), as_attachment=True,
                            filename=f"{attestation.numero}.pdf")


class AttestationPubliqueView(APIView):
    """Vérification PUBLIQUE d'une attestation — cible du QR imprimé.

    Public comme le reçu : le lien signé (`?sig=`) fait foi. On affiche
    l'attestation ENREGISTRÉE dans le HUB (source de vérité), pas une capture.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, numero):
        from .liens import verifier_lien

        signature = request.query_params.get("sig", "")
        if not verifier_lien(numero, signature):
            return Response({"detail": "Lien de vérification invalide."}, status=403)
        attestation = (AttestationFormation.objects
                       .select_related("inscription__participant",
                                        "inscription__formation")
                       .filter(numero=numero).first())
        if attestation is None:
            return Response({"detail": "Attestation introuvable."}, status=404)
        inscription = attestation.inscription
        formation = inscription.formation
        return Response({
            "numero": attestation.numero,
            "date_delivrance": attestation.date_delivrance,
            "mention": attestation.mention,
            "genere_le": attestation.genere_le,
            "participant": inscription.participant.full_name,
            "participant_email": inscription.participant.email,
            "inscription": inscription.reference,
            "formation": formation.titre,
            "formation_duree": formation.duree,
            "formation_date_debut": formation.date_debut,
            "formation_date_fin": formation.date_fin,
            "formation_lieu": formation.lieu,
            "emetteur": settings.FRONTEND_URL,
        })
