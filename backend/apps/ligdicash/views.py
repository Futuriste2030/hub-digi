"""API LigdiCash — payin avec redirection (SPEC §5.7).

Quatre surfaces :
  - initiation authentifiée (portail client / agence) ;
  - initiation publique via le lien signé figé dans le QR de la facture ;
  - callback LigdiCash (public) : notification RE-VÉRIFIÉE via /confirm ;
  - lecture de statut (authentifiée + publique signée) : page de retour.

Règle : le montant affiché et le montant débité proviennent toujours du
serveur. Le client ne peut jamais imposer un montant.
"""

import json

from django.conf import settings as dj_settings
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.finance.models import Invoice, Receipt

from .models import PayinTransaction
from .liens import paiement_en_ligne_actif
from .services import (
    LigdiCashError,
    confirmer,
    extraire_transaction_id,
    initier_paiement,
    montant_xof,
    verifier_transaction,
)
from .signing import signer_recu, signer_transaction, verifier

# Rôles internes autorisés à encaisser : la finance (et le super admin).
ROLES_PAIEMENT = ("super_admin", "chef_finance", "membre_finance")


def _facture_payable(user, facture_id):
    """(facture, erreur, code_http) — contrôle d'accès sur la facture à payer."""
    try:
        facture_id = int(facture_id)
    except (TypeError, ValueError):
        return None, "Facture invalide.", 400
    facture = Invoice.objects.filter(id=facture_id).first()
    if facture is None:
        return None, "Facture introuvable.", 404
    if user.role == "client":
        if not user.client_id:
            return None, "Aucun compte client lié.", 403
        if facture.client_id != user.client_id:
            return None, "Facture inaccessible.", 403
    elif user.role not in ROLES_PAIEMENT:
        return None, "Paiement en ligne réservé au client ou au service finance.", 403
    return facture, None, 200


def _reponse_transaction(transaction, pay_url):
    return {
        "transaction_id": transaction.transaction_id,
        "pay_url": pay_url,
        "montant": transaction.montant,
        "devise": transaction.devise,
        "statut": transaction.statut,
        "facture_numero": transaction.invoice.numero if transaction.invoice_id else "",
        "signature": signer_transaction(transaction.transaction_id),
        "return_url": f"{dj_settings.FRONTEND_URL.rstrip('/')}/paiement/retour"
                      f"?txn={transaction.transaction_id}&sig={signer_transaction(transaction.transaction_id)}",
    }


def _statut_transaction(transaction):
    facture = transaction.invoice
    recu = Receipt.objects.filter(ref_transaction=transaction.transaction_id).first()
    return {
        "transaction_id": transaction.transaction_id,
        "statut": transaction.statut,
        "montant": transaction.montant,
        "devise": transaction.devise,
        "facture_numero": facture.numero if facture else "",
        "client": facture.destinataire_nom if facture else "",
        "operator_name": transaction.operator_name,
        "recu_numero": recu.numero if recu else "",
        "erreur": transaction.erreur,
    }


def _resume_facture(facture):
    """Résumé public d'une facture (page de paiement) — montants en XOF entier."""
    from apps.core.models import SiteSettings

    site = SiteSettings.objects.first()
    return {
        "numero": facture.numero,
        "type_doc": facture.type_doc,
        "client": facture.destinataire_nom,
        "description": f"Règlement {facture.numero}",
        "lignes": [
            {"description": l.description, "quantite": float(l.quantite or 0),
             "montant": montant_xof((l.montant or 0) * (l.quantite or 0))}
            for l in facture.lignes.all()
        ],
        "total": montant_xof(facture.total),
        "paye": montant_xof(facture.paye),
        "montant_a_payer": montant_xof(facture.solde),
        "devise": "XOF",
        "statut": facture.statut,
        "delai_paiement": site.delai_paiement if site else "",
        "paiement_en_cours": bool(
            PayinTransaction.objects.filter(invoice=facture, statut=PayinTransaction.STATUT_PENDING).exists()
        ),
    }


class LigdiCashInitierView(APIView):
    """POST /finance/paiements/ligdicash/initier/ — initiation authentifiée.

    Corps : {facture_id}. Le client paie sa propre facture, la finance encaisse
    une facture de son portefeuille. Le montant est relu en base.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not paiement_en_ligne_actif():
            return Response({"detail": "Paiement en ligne désactivé."}, status=503)
        facture, erreur, code = _facture_payable(request.user, request.data.get("facture_id"))
        if erreur:
            return Response({"detail": erreur}, status=code)
        if facture.solde <= 0:
            return Response({"detail": "Cette facture est déjà réglée."}, status=400)
        try:
            transaction, pay_url = initier_paiement(facture)
        except LigdiCashError as e:
            return Response({"detail": e.message}, status=502)
        return Response(_reponse_transaction(transaction, pay_url), status=201)


class LigdiCashInitierLienView(APIView):
    """POST /finance/paiements/ligdicash/initier-lien/ — initiation via le lien signé.

    Autorisation = la signature portée par le lien (figée dans le QR de la
    facture). Le navigateur n'envoie aucun montant : il est recalculé ici.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def post(self, request):
        if not paiement_en_ligne_actif():
            return Response({"detail": "Paiement en ligne désactivé."}, status=503)
        numero = (request.data.get("facture") or "").strip()
        signature = (request.data.get("sig") or "").strip()
        if not verifier(numero, "facture", signature):
            return Response({"detail": "Lien de paiement invalide."}, status=403)
        facture = Invoice.objects.filter(numero=numero).first()
        if facture is None:
            return Response({"detail": "Facture introuvable."}, status=404)
        if facture.solde <= 0:
            return Response({"detail": "Cette facture est déjà réglée."}, status=400)
        try:
            transaction, pay_url = initier_paiement(facture)
        except LigdiCashError as e:
            return Response({"detail": e.message}, status=502)
        return Response(_reponse_transaction(transaction, pay_url), status=201)


class LigdiCashFacturePubliqueView(APIView):
    """GET /finance/paiements/ligdicash/facture/<numero>/?sig=... — page de paiement.

    Le lien est signé : il est figé dans le QR de la facture et ne doit pas
    pouvoir être deviné.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def get(self, request, numero):
        if not verifier(numero, "facture", request.query_params.get("sig", "")):
            return Response({"detail": "Lien de paiement invalide."}, status=403)
        facture = Invoice.objects.filter(numero=numero).first()
        if facture is None:
            return Response({"detail": "Facture introuvable."}, status=404)
        return Response(_resume_facture(facture))


class LigdiCashRecuPubliqueView(APIView):
    """GET /finance/paiements/ligdicash/recu/<numero>/?sig=... — vérification d'un reçu.

    Le QR du reçu (PDF et document imprimable) pointe ici : le client scanne
    pour vérifier l'authenticité du règlement.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def get(self, request, numero):
        if not verifier(numero, "recu", request.query_params.get("sig", "")):
            return Response({"detail": "Lien de vérification invalide."}, status=403)
        recu = Receipt.objects.filter(numero=numero).select_related("invoice").first()
        if recu is None:
            return Response({"detail": "Reçu introuvable."}, status=404)
        facture = recu.invoice
        return Response({
            "numero": recu.numero,
            "montant": montant_xof(recu.montant),
            "devise": "XOF",
            "moyen": recu.get_moyen_display(),
            "date": recu.cree_le.isoformat() if recu.cree_le else "",
            "facture_numero": facture.numero,
            "client": facture.destinataire_nom,
            "statut_facture": facture.get_statut_display(),
            "signature": signer_recu(recu.numero),
        })


class LigdiCashStatutView(APIView):
    """GET /finance/paiements/ligdicash/<transaction_id>/statut/ — statut (authentifié).

    Relit /confirm : le statut affiché est celui de LigdiCash, jamais celui
    déduit de l'URL de retour.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, transaction_id):
        transaction = (PayinTransaction.objects
                       .filter(transaction_id=transaction_id)
                       .select_related("invoice").first())
        if transaction is None:
            return Response({"detail": "Transaction inconnue."}, status=404)
        if request.user.role == "client":
            if not transaction.invoice_id or transaction.invoice.client_id != request.user.client_id:
                return Response({"detail": "Transaction inaccessible."}, status=403)
        elif request.user.role not in ROLES_PAIEMENT:
            return Response({"detail": "Accès réservé au service finance."}, status=403)
        try:
            verifier_transaction(transaction)
        except LigdiCashError:
            pass
        return Response(_statut_transaction(transaction))


class LigdiCashRetourView(APIView):
    """GET /finance/paiements/ligdicash/retour/<transaction_id>/?sig=... — page de retour.

    Le client vient de revenir de la page LigdiCash : on lui affiche l'état
    réel du paiement, re-vérifié auprès de LigdiCash.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    def get(self, request, transaction_id):
        if not verifier(transaction_id, "transaction", request.query_params.get("sig", "")):
            return Response({"detail": "Lien de retour invalide."}, status=403)
        transaction = (PayinTransaction.objects
                       .filter(transaction_id=transaction_id)
                       .select_related("invoice").first())
        if transaction is None:
            return Response({"detail": "Transaction inconnue."}, status=404)
        try:
            verifier_transaction(transaction)
        except LigdiCashError:
            pass
        return Response(_statut_transaction(transaction))


class LigdiCashCallbackView(APIView):
    """POST /finance/paiements/ligdicash/callback/ — notification LigdiCash (public).

    LigdiCash envoie 2 POST par événement (un JSON, un form-urlencoded) avec
    le même contenu : la déduplication passe par le statut en base (seule une
    transaction « pending » est traitée).

    Le payload n'est JAMAIS cru : on relit le token de CRÉATION en base et on
    redemande le statut à /confirm.

    Traçabilité : chaque POST reçu est journalisé dans CallbackLigdiCash
    (corps brut, en-têtes, IP, réponse) — y compris les sondes sans
    transaction_id. La réponse est TOUJOURS en 200 : un 4xx ferait retryer
    LigdiCash et ferait échouer la validation de l'intégration.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook"

    # En-têtes conservés dans le journal (trace lisible pour l'équipe LigdiCash).
    ENTETES_JOURNAL = ("Content-Type", "User-Agent", "Accept", "Content-Length",
                       "X-Forwarded-For", "X-Real-IP", "X-Forwarded-Proto", "X-Hub-Token")

    def post(self, request):
        journal = self._journaliser(request)
        transaction_id = extraire_transaction_id(request.data)
        journal.transaction_id = transaction_id or ""
        if not transaction_id:
            return self._repondre(journal, 200, "transaction_id absent du callback.")
        transaction = (PayinTransaction.objects
                       .filter(transaction_id=transaction_id)
                       .select_related("invoice").first())
        if transaction is None:
            return self._repondre(journal, 200, "Transaction inconnue.")
        if transaction.statut != PayinTransaction.STATUT_PENDING:
            # Doublon (2e POST de LigdiCash) ou transaction déjà traitée.
            return self._repondre(journal, 200, "Déjà traité.", statut=transaction.statut)
        transaction.callback_recu_le = timezone.now()
        transaction.save(update_fields=["callback_recu_le"])
        try:
            data = confirmer(transaction.ligdicash_token)
        except LigdiCashError:
            return self._repondre(journal, 200, "Vérification indisponible.", statut=transaction.statut)
        if data.get("response_code") != "00" or not data.get("status"):
            return self._repondre(journal, 200, "Statut non confirmé.", statut=transaction.statut)
        from .services import appliquer_statut

        appliquer_statut(transaction, data["status"], data)
        return self._repondre(journal, 200, "ok", statut=transaction.statut)

    def _journaliser(self, request):
        """Enregistre le POST reçu tel quel (avant tout traitement)."""
        from .models import CallbackLigdiCash

        corps = ""
        try:
            corps = request.body.decode("utf-8", "replace")
        except Exception:
            corps = ""
        payload = request.data if isinstance(request.data, dict) else {}
        try:
            payload = {k: (v if isinstance(v, (str, int, float, bool, type(None))) else str(v))
                       for k, v in payload.items()}
        except Exception:
            payload = {"_brut": corps[:2000]}
        entetes = {}
        for nom in self.ENTETES_JOURNAL:
            if request.META.get("HTTP_" + nom.upper().replace("-", "_")):
                entetes[nom] = request.META["HTTP_" + nom.upper().replace("-", "_")]
        ip = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR") or ""
        return CallbackLigdiCash.objects.create(
            content_type=(request.META.get("CONTENT_TYPE") or "")[:120],
            corps_brut=corps[:20000],
            payload=payload,
            entetes=entetes,
            source_ip=ip.split(",")[0].strip()[:64],
        )

    def _repondre(self, journal, code, detail, statut=""):
        """Réponse + enregistrement de ce qu'on a renvoyé (traçabilité)."""
        corps = {"detail": detail}
        if statut:
            corps["statut"] = statut
        journal.statut_reponse = str(code)
        journal.reponse = json.dumps(corps, ensure_ascii=False)
        journal.save(update_fields=["statut_reponse", "reponse", "transaction_id"])
        return Response(corps, status=code)
