"""RH API — SPEC §5.5/§12 : employees/leaves/validate + webhook candidatures (WEBHOOK-CARRIERE.md)
+ pointage QR (statut/qr/scan/pointages)."""

import math
import re
import secrets
from calendar import monthrange
from datetime import date, datetime, timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Candidature, Employee, Leave, Pointage, Prime, QRToken, SitePointage


class EmployeeSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "user", "email", "fonction", "date_embauche", "solde_conges", "en_conge"]


class LeaveSerializer(serializers.ModelSerializer):
    duree = serializers.ReadOnlyField()

    class Meta:
        model = Leave
        fields = ["id", "employe", "du_jour", "au_jour", "motif", "statut", "valideur",
                  "commentaire", "duree", "cree_le"]
        read_only_fields = ["statut", "valideur"]


class CandidatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidature
        fields = ["id", "offre_reference", "offre_titre", "nom", "email", "telephone",
                  "message", "cv_url", "source", "statut", "cree_le"]


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["user__email", "fonction"]


class LeaveViewSet(viewsets.ModelViewSet):
    queryset = Leave.objects.select_related("employe").all()
    serializer_class = LeaveSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["employe", "statut"]

    @action(detail=True, methods=["patch"])
    def validate(self, request, pk=None):
        """RH/admin valide ou refuse (SPEC §5.5.2)."""
        conge = self.get_object()
        if request.user.role not in ("super_admin", "admin", "chef_rh"):
            return Response({"detail": "Réservé RH/admin."}, status=403)
        decision = request.data.get("decision")
        if decision not in ("valide", "refuse"):
            return Response({"detail": "decision: valide | refuse."}, status=400)
        if decision == "refuse" and not request.data.get("commentaire"):
            return Response({"detail": "Commentaire obligatoire en cas de refus."}, status=400)
        conge.statut = Leave.STATUT_VALIDE if decision == "valide" else Leave.STATUT_REFUSE
        conge.valideur = request.user
        conge.commentaire = request.data.get("commentaire", "")
        if decision == "valide":
            conge.employe.solde_conges = max(0, float(conge.employe.solde_conges) - conge.duree)
            conge.employe.save()
        conge.save()
        return Response(LeaveSerializer(conge).data)


class CandidatureWebhookView(APIView):
    """Webhook site vitrine -> HUB (public, token X-Hub-Token, throttle 60/min)."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def post(self, request):
        token = request.headers.get("X-Hub-Token", "")
        if not settings.CAREER_WEBHOOK_TOKEN or not constant_time_compare(token, settings.CAREER_WEBHOOK_TOKEN):
            return Response({"detail": "refusé"}, status=403)
        email = request.data.get("email", "")
        offre_ref = request.data.get("offre_reference", "")
        if not email or "@" not in email or not request.data.get("nom"):
            return Response({"detail": "nom + email valides requis."}, status=400)
        cand, created = Candidature.objects.get_or_create(
            email=email, offre_reference=offre_ref,
            defaults={
                "offre_titre": request.data.get("offre_titre", ""),
                "nom": request.data.get("nom", ""),
                "telephone": request.data.get("telephone", ""),
                "message": request.data.get("message", ""),
                "cv_url": request.data.get("cv_url") or "",
                "source": "site",
            },
        )
        status = 201 if created else 200
        return Response({"id": cand.id, "statut": "Reçue" if created else "doublon"}, status=status)


# ---------------------------------------------------------------------------
# Pointage QR dynamique — SPEC §5.5 (MAJ 05/10/2026).
# Horaires verrouillés 08h00–17h00 (heure serveur Africa/Bamako) :
# l'écran post-login ne s'affiche que dans cette plage.
# ---------------------------------------------------------------------------

QR_TTL_S = 60  # QR dynamique : renouvelé toutes les 10 s côté front, valide 60 s
QR_SALT = "hub-pointage"
# Marge de sortie : l'écran + les scans restent possibles jusqu'à 17h30
# (départ scanné après 17h00 = normal, pas de retard le soir).
MARGE_SORTIE_MIN = 30
ROLES_RH_TOUS = ("super_admin", "admin", "chef_rh", "membre_rh")


def _site_actif():
    return SitePointage.objects.filter(actif=True).first()


def _distance_m(lat1, lng1, lat2, lng2):
    """Haversine (mètres) — anti-fraude GPS."""
    r = 6371000.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lng2) - float(lng1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _employeur(user):
    """Fiche employé liée au compte, ou None."""
    try:
        return user.fiche_employe
    except Employee.DoesNotExist:
        return None


def _type_attendu(employe, site, maintenant):
    """arrivee | depart | rien — selon pointage du jour + heure serveur."""
    pt = Pointage.objects.filter(employe=employe, date=maintenant.date()).first()
    if pt is None or pt.heure_arrivee is None:
        return "arrivee", pt
    if pt.heure_depart is None and maintenant.time() >= datetime.strptime("12:00", "%H:%M").time():
        return "depart", pt
    return "rien", pt


class PointageSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source="employe.user.email", read_only=True)

    class Meta:
        model = Pointage
        fields = ["id", "employe", "email", "date", "heure_arrivee", "statut_arrivee",
                  "heure_depart", "statut_depart", "distance_m", "cree_le"]


class PointageStatutView(APIView):
    """Doit-on afficher l'écran de pointage post-login ? (heure serveur)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        site = _site_actif()
        maintenant = timezone.localtime()
        if site is None:
            return Response({"doit_pointer": False, "motif": "Site de pointage non configuré (RH)."})
        employe = _employeur(request.user)
        if employe is None:
            return Response({"doit_pointer": False, "motif": "Aucune fiche employé liée."})
        # Plage 08h00–17h00 + marge de sortie 30 min (départ scannable jusqu'à 17h30).
        fin = (datetime.combine(maintenant.date(), site.heure_depart)
               + timedelta(minutes=MARGE_SORTIE_MIN)).time()
        if not (site.heure_arrivee <= maintenant.time() < fin):
            return Response({"doit_pointer": False, "motif": "Hors horaires (08h00–17h00).",
                             "heure_serveur": maintenant.strftime("%H:%M")})
        type_attendu, _pt = _type_attendu(employe, site, maintenant)
        if type_attendu == "rien":
            return Response({"doit_pointer": False, "motif": "Pointage du jour terminé.",
                             "heure_serveur": maintenant.strftime("%H:%M")})
        return Response({
            "doit_pointer": True,
            "type_attendu": type_attendu,
            "heure_serveur": maintenant.strftime("%H:%M"),
            "site": site.nom,
        })


class QRChallengeView(APIView):
    """Génère le QR dynamique affiché sur le desktop (TTL court, usage unique)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        employe = _employeur(request.user)
        if employe is None:
            return Response({"detail": "Aucune fiche employé liée."}, status=400)
        maintenant = timezone.localtime()
        type_attendu, _pt = _type_attendu(employe, _site_actif(), maintenant)
        if type_attendu == "rien":
            return Response({"detail": "Rien à pointer pour le moment."}, status=400)
        nonce = secrets.token_hex(16)
        expire_le = timezone.now() + timedelta(seconds=QR_TTL_S)
        QRToken.objects.create(employe=employe, nonce=nonce, expire_le=expire_le)
        # Nettoie les QR périmés (régénéré toutes les 10 s côté front).
        QRToken.objects.filter(employe=employe, utilise=False,
                               expire_le__lt=timezone.now()).delete()
        QRToken.objects.filter(expire_le__lt=timezone.now() - timedelta(days=1)).delete()
        payload = signing.TimestampSigner(salt=QR_SALT).sign(f"{employe.id}:{nonce}")
        return Response({"qr": payload, "expire_le": expire_le, "type_attendu": type_attendu},
                        status=201)


class PointageScanView(APIView):
    """Valide un scan mobile : QR + GPS entreprise + horaires serveur."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        site = _site_actif()
        if site is None:
            return Response({"detail": "Site de pointage non configuré."}, status=400)
        employe = _employeur(request.user)
        if employe is None:
            return Response({"detail": "Aucune fiche employé liée."}, status=400)
        # 1. QR signé, TTL 120 s.
        try:
            contenu = signing.TimestampSigner(salt=QR_SALT).unsign(
                request.data.get("qr", ""), max_age=QR_TTL_S)
            emp_id, nonce = contenu.split(":")
        except Exception:
            return Response({"detail": "QR invalide ou expiré — régénérez-le."}, status=400)
        if str(employe.id) != str(emp_id):
            return Response({"detail": "Ce QR appartient à un autre employé."}, status=403)
        try:
            token = QRToken.objects.get(nonce=nonce, employe=employe)
        except QRToken.DoesNotExist:
            return Response({"detail": "QR inconnu."}, status=400)
        if token.utilise or token.expire_le < timezone.now():
            return Response({"detail": "QR déjà utilisé ou expiré — régénérez-le."}, status=400)
        # 2. GPS entreprise (anti-fraude localisation).
        try:
            lat = float(request.data.get("latitude"))
            lng = float(request.data.get("longitude"))
        except (TypeError, ValueError):
            return Response({"detail": "Position GPS requise."}, status=400)
        distance = _distance_m(lat, lng, site.latitude, site.longitude)
        if distance > site.rayon_m:
            return Response({"detail": f"Hors zone entreprise ({int(distance)} m, limite {site.rayon_m} m)."},
                            status=403)
        # 3. Horaires serveur 08h00–17h00 + marge de sortie 30 min.
        maintenant = timezone.localtime()
        fin = (datetime.combine(maintenant.date(), site.heure_depart)
               + timedelta(minutes=MARGE_SORTIE_MIN)).time()
        if not (site.heure_arrivee <= maintenant.time() < fin):
            return Response({"detail": "Hors horaires de pointage (08h00–17h00)."}, status=400)
        type_attendu, _pt = _type_attendu(employe, site, maintenant)
        if type_attendu == "rien":
            return Response({"detail": "Pointage du jour déjà terminé."}, status=400)
        pt, _created = Pointage.objects.get_or_create(
            employe=employe, date=maintenant.date(),
            defaults={"latitude": lat, "longitude": lng, "distance_m": round(distance, 1)},
        )
        if type_attendu == "arrivee":
            if pt.heure_arrivee is not None:
                return Response({"detail": "Arrivée déjà pointée."}, status=400)
            limite = (datetime.combine(maintenant.date(), site.heure_arrivee)
                      + timedelta(minutes=site.tolerance_retard_min)).time()
            pt.heure_arrivee = maintenant
            pt.statut_arrivee = Pointage.STATUT_RETARD if maintenant.time() > limite else Pointage.STATUT_HEURE
        else:
            if pt.heure_arrivee is None:
                return Response({"detail": "Pointez d'abord l'arrivée."}, status=400)
            if pt.heure_depart is not None:
                return Response({"detail": "Départ déjà pointé."}, status=400)
            pt.heure_depart = maintenant
            pt.statut_depart = (Pointage.STATUT_NORMAL
                                if maintenant.time() >= site.heure_depart else Pointage.STATUT_ANTICIPE)
            pt.latitude = lat
            pt.longitude = lng
            pt.distance_m = round(distance, 1)
        pt.save()
        token.utilise = True
        token.save(update_fields=["utilise"])
        return Response({
            "type": type_attendu,
            "statut": pt.statut_arrivee if type_attendu == "arrivee" else pt.statut_depart,
            "heure": maintenant.strftime("%H:%M"),
            "distance_m": int(distance),
        }, status=201)


class PointageViewSet(viewsets.ReadOnlyModelViewSet):
    """Liste des pointages — RH : tous ; autres : les siens uniquement."""

    queryset = Pointage.objects.select_related("employe__user").all()
    serializer_class = PointageSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["employe", "date", "statut_arrivee", "statut_depart"]
    ordering = ["-date"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role in ROLES_RH_TOUS:
            return qs
        employe = _employeur(self.request.user)
        return qs.filter(employe=employe) if employe else qs.none()


# ---------------------------------------------------------------------------
# Rapports mensuels + employé du mois + primes (MAJ 05/10/2026).
# Score /100 : présence 40 + ponctualité 30 + heures 20 + assiduité 10.
# ---------------------------------------------------------------------------

ROLES_CHEF_RH_VALID = ("super_admin", "admin", "chef_rh")
HEURES_JOUR_ATTENDUES = 9.0  # 08h00–17h00


def _rapport_mensuel(mois):
    """Calcule les lignes du mois + gagnant. mois = 'AAAA-MM'."""
    annee, num = map(int, mois.split("-"))
    premier = date(annee, num, 1)
    dernier = date(annee, num, monthrange(annee, num)[1])
    aujourd = timezone.localtime().date()
    fin_ouvres = min(dernier, aujourd) if premier <= aujourd else premier - timedelta(days=1)
    jours_ouvres = sum(1 for d in range((fin_ouvres - premier).days + 1)
                       if (premier + timedelta(days=d)).weekday() < 5) if fin_ouvres >= premier else 0
    lignes = []
    for emp in Employee.objects.select_related("user").order_by("user__email"):
        pts = Pointage.objects.filter(employe=emp, date__gte=premier, date__lte=dernier)
        presents = pts.filter(heure_arrivee__isnull=False).count()
        retards = pts.filter(statut_arrivee=Pointage.STATUT_RETARD).count()
        anticipes = pts.filter(statut_depart=Pointage.STATUT_ANTICIPE).count()
        heures = 0.0
        for p in pts.filter(heure_arrivee__isnull=False, heure_depart__isnull=False):
            heures += (p.heure_depart - p.heure_arrivee).total_seconds() / 3600
        absences = max(jours_ouvres - presents, 0)
        presence = min(presents / max(jours_ouvres, 1), 1) if jours_ouvres else 0
        ponctualite = ((presents - retards) / presents) if presents else 0
        taux_heures = min(heures / (presents * HEURES_JOUR_ATTENDUES), 1) if presents else 0
        score = round(presence * 40 + ponctualite * 30 + taux_heures * 20
                      + (10 if (absences == 0 and presents > 0) else 0), 1)
        lignes.append({
            "employe": emp.id,
            "email": emp.user.email,
            "presents": presents,
            "retards": retards,
            "departs_anticipes": anticipes,
            "absences": absences,
            "heures": round(heures, 1),
            "score": score,
        })
    candidats = [l for l in lignes if l["presents"] > 0]
    candidats.sort(key=lambda l: (-l["score"], l["retards"], -l["heures"]))
    gagnant = candidats[0] if candidats else None
    return {"mois": mois, "jours_ouvres": jours_ouvres, "lignes": lignes, "gagnant": gagnant}


def _prime_gagnant(site, gagnant, mois):
    if not gagnant:
        return None
    prime, _created = Prime.objects.get_or_create(
        employe_id=gagnant["employe"], mois=mois,
        defaults={"montant": site.prime_montant if site else 25000,
                  "motif": f"Employé du mois {mois} — score {gagnant['score']}/100"},
    )
    return prime


class PrimeSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source="employe.user.email", read_only=True)

    class Meta:
        model = Prime
        fields = ["id", "employe", "email", "mois", "montant", "motif", "validee", "cree_le"]


class PrimeViewSet(viewsets.ReadOnlyModelViewSet):
    """Primes mensuelles — lecture RH, validation chef RH/admin."""

    serializer_class = PrimeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["employe", "mois", "validee"]

    def get_queryset(self):
        return Prime.objects.select_related("employe__user").all()

    @action(detail=True, methods=["patch"])
    def valider(self, request, pk=None):
        if request.user.role not in ROLES_CHEF_RH_VALID:
            return Response({"detail": "Validation réservée RH/admin."}, status=403)
        prime = self.get_object()
        prime.validee = True
        prime.save(update_fields=["validee"])
        return Response(PrimeSerializer(prime).data)


class RapportMensuelView(APIView):
    """Rapport auto du mois + employé du mois + prime proposée."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ROLES_RH_TOUS:
            return Response({"detail": "Rapport réservé à la RH."}, status=403)
        mois = request.query_params.get("mois") or timezone.localtime().strftime("%Y-%m")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", mois):
            return Response({"detail": "mois attendu au format AAAA-MM."}, status=400)
        site = _site_actif()
        rapport = _rapport_mensuel(mois)
        prime = _prime_gagnant(site, rapport["gagnant"], mois)
        rapport["prime"] = PrimeSerializer(prime).data if prime else None
        rapport["prime_defaut"] = site.prime_montant if site else 25000
        return Response(rapport)


class RapportPdfView(APIView):
    """Rapport mensuel en PDF (charte marine, comme les factures)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.http import HttpResponse

        if request.user.role not in ROLES_RH_TOUS:
            return Response({"detail": "Rapport réservé à la RH."}, status=403)
        mois = request.query_params.get("mois") or timezone.localtime().strftime("%Y-%m")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", mois):
            return Response({"detail": "mois attendu au format AAAA-MM."}, status=400)
        site = _site_actif()
        rapport = _rapport_mensuel(mois)
        prime = _prime_gagnant(site, rapport["gagnant"], mois)
        rapport["prime"] = PrimeSerializer(prime).data if prime else None
        from .pdf import rapport_pointage_pdf

        buf = rapport_pointage_pdf(rapport)
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="rapport-pointage-{mois}.pdf"'
        return resp
