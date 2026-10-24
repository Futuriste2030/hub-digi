"""Service LigdiCash — payin avec redirection (SPEC §5.7).

Appels API : stdlib uniquement (urllib) — aucune dépendance supplémentaire à
installer sur le serveur (requirements.txt reste inchangé).

Règle d'or LigdiCash : le payload reçu n'est jamais une preuve. Le callback
est re-vérifié via /confirm avec le token de CRÉATION stocké en base, et c'est
le statut de /confirm qui décide. Le montant encaissé est comparé au montant
FIGÉ à l'initiation : un écart n'est jamais encaissé automatiquement.
"""

import json
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from .models import PayinTransaction
from .signing import signer_transaction

CHEMIN_CREATE = "/pay/v01/redirect/checkout-invoice/create"
CHEMIN_CONFIRM = "/pay/v01/redirect/checkout-invoice/confirm"

# Fenêtre de reprise : une tentative en cours de moins de 15 min est réutilisée
# (double-clic, retour arrière) — on ne crée pas deux factures LigdiCash.
# 15 min et non 30 : la page de paiement LigdiCash cesse de répondre ~16 min
# après la création de la facture (mesuré), une URL plus ancienne est morte.
# Le contrôle page_paiement_valide() reste le filet de sécurité.
FENETRE_REPRISE = timedelta(
    minutes=int(getattr(settings, "LIGDICASH_FENETRE_REPRISE_MINUTES", 15) or 15))


class LigdiCashError(Exception):
    """Appel API refusé ou réseau indisponible."""

    def __init__(self, message, code="erreur", detail=""):
        super().__init__(message)
        self.message = message
        self.code = code
        self.detail = detail


def _entetes():
    return {
        "Apikey": settings.LIGDICASH_API_KEY,
        "Authorization": f"Bearer {settings.LIGDICASH_API_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def appeler_api(chemin, methode="GET", payload=None, params=None):
    """Appel JSON vers l'API LigdiCash. Lève LigdiCashError en cas d'échec."""
    base = settings.LIGDICASH_BASE_URL.rstrip("/")
    url = f"{base}{chemin}"
    if params:
        url = f"{url}?{urlencode(params)}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    requete = Request(url, data=data, method=methode, headers=_entetes())
    try:
        with urlopen(requete, timeout=settings.LIGDICASH_TIMEOUT) as reponse:
            corps = reponse.read().decode("utf-8", "replace")
    except HTTPError as e:
        corps = e.read().decode("utf-8", "replace")
        raise LigdiCashError(
            f"LigdiCash a répondu en erreur HTTP {e.code}.", code=f"http_{e.code}", detail=corps[:500])
    except (URLError, OSError) as e:
        raise LigdiCashError(f"LigdiCash injoignable : {e}", code="reseau")
    try:
        return json.loads(corps)
    except ValueError:
        raise LigdiCashError(
            "Réponse LigdiCash illisible (JSON invalide).", code="reponse_invalide", detail=corps[:500])


def montant_xof(valeur):
    """LigdiCash n'accepte que des entiers XOF : arrondi au franc le plus proche."""
    try:
        return int(Decimal(str(valeur or 0)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError, TypeError):
        return 0


def url_retour(page, transaction_id):
    """URL de retour (retour/annule) du SPA, signée pour la transaction."""
    base = settings.FRONTEND_URL.rstrip("/")
    sig = signer_transaction(transaction_id)
    return f"{base}/paiement/{page}?txn={transaction_id}&sig={sig}"


def _nom_client(invoice):
    """Prénom / nom affichés sur la page de paiement LigdiCash."""
    client = getattr(invoice, "client", None)
    if client is None:
        return "", ""
    contact = (getattr(client, "contact", "") or "").strip()
    if contact:
        morceaux = contact.split()
        return morceaux[0], " ".join(morceaux[1:])
    return (getattr(client, "nom_societe", "") or "").strip(), ""


def _items(invoice, total):
    """Items LigdiCash dont la somme est exactement `total` (XOF entier)."""
    items = []
    for ligne in invoice.lignes.all():
        quantite = max(1, int(round(float(ligne.quantite or 1))))
        total_ligne = montant_xof((ligne.montant or 0) * (ligne.quantite or 0))
        if total_ligne <= 0:
            continue
        items.append({
            "name": (ligne.description or "Prestation")[:120],
            "description": (ligne.description or "")[:255],
            "quantity": quantite,
            "unit_price": montant_xof(ligne.montant),
            "total_price": total_ligne,
        })
    if not items or sum(i["total_price"] for i in items) != total:
        # Facture partiellement réglée ou arrondi : un item unique aligné sur le montant.
        items = [{
            "name": f"Solde {invoice.numero or 'facture'}",
            "description": "Règlement de la facture",
            "quantity": 1,
            "unit_price": total,
            "total_price": total,
        }]
    return items


def construire_payload_facture(invoice, transaction_id, montant=None):
    """Payload de création de facture (POST /pay/v01/redirect/checkout-invoice/create).

    Deux contraintes LigdiCash non négociables :
      - `customer` DOIT rester vide : un numéro renseigné filtre la page de
        paiement et masque les autres opérateurs ;
      - `otp` reste vide en payin avec redirection.
    """
    total = montant_xof(montant if montant is not None else invoice.solde)
    prenom, nom = _nom_client(invoice)
    destinataire = invoice.destinataire_nom or ""
    return {
        "commande": {
            "invoice": {
                "items": _items(invoice, total),
                "total_amount": total,
                "devise": "XOF",
                "description": f"Règlement {invoice.numero or 'facture'}"
                               + (f" — {destinataire}" if destinataire else ""),
                "customer": "",
                "customer_firstname": prenom,
                "customer_lastname": nom,
                "customer_email": invoice.destinataire_email or "",
                "external_id": transaction_id,
                "otp": "",
            },
            "store": {
                "name": settings.LIGDICASH_STORE_NAME,
                "website_url": settings.LIGDICASH_STORE_URL,
            },
            "actions": {
                "cancel_url": url_retour("annule", transaction_id),
                "return_url": url_retour("retour", transaction_id),
                "callback_url": settings.LIGDICASH_CALLBACK_URL,
            },
            "custom_data": {
                "transaction_id": transaction_id,
                "invoice_numero": invoice.numero or "",
            },
        },
    }


def creer_facture(invoice, transaction_id, montant=None):
    """Crée la facture chez LigdiCash -> (token de création, pay_url)."""
    payload = construire_payload_facture(invoice, transaction_id, montant)
    data = appeler_api(CHEMIN_CREATE, methode="POST", payload=payload)
    if data.get("response_code") != "00":
        raise LigdiCashError(
            f"LigdiCash a refusé la facture : {data.get('response_text') or 'erreur inconnue'}.",
            code="create_refuse",
            detail=json.dumps(data, ensure_ascii=False)[:500],
        )
    return data.get("token", ""), data.get("response_text", "")


def confirmer(token):
    """GET /pay/v01/redirect/checkout-invoice/confirm?invoiceToken=... -> dict."""
    if not token:
        raise LigdiCashError("Token de création absent : /confirm impossible.", code="token_absent")
    return appeler_api(CHEMIN_CONFIRM, methode="GET", params={"invoiceToken": token})


def extraire_transaction_id(payload):
    """Extrait le transaction_id du payload de callback.

    `custom_data` arrive sous plusieurs formes selon le flux (tableau
    d'entrées, objet, ou chaîne JSON sérialisée quand LigdiCash poste en
    form-urlencoded) : on tolère les trois. En repli, `external_id` porte
    exactement la même valeur (seul custom_data dont la clé contient « id »).
    """
    data = (payload or {}).get("custom_data")
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except ValueError:
            data = None
    if isinstance(data, dict):
        valeur = data.get("transaction_id")
        if valeur:
            return str(valeur)
    if isinstance(data, list):
        for entree in data:
            if isinstance(entree, dict) and entree.get("keyof_customdata") == "transaction_id":
                valeur = entree.get("valueof_customdata")
                if valeur:
                    return str(valeur)
    externe = (payload or {}).get("external_id")
    return str(externe) if externe else None


def page_paiement_valide(pay_url):
    """True si l'URL LigdiCash sert bien la page de paiement.

    LigdiCash peut exposer une facture via /confirm (statut « pending »)
    tout en servant une page 404 au client sur la page de paiement
    (propagation asynchrone côté LigdiCash). Envoyer le client vers une page
    morte = paiement impossible sans aucune erreur visible côté HUB DIGI.

    Contrôle : la page de paiement valide contient « Transaction ID » ;
    la page 404 de LigdiCash contient « incorrecte »."""
    if not pay_url:
        return False
    if not getattr(settings, "LIGDICASH_VERIF_PAGE", True):
        return True
    try:
        requete = Request(pay_url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; HUB-DIGI/1.0)",
            "Accept": "text/html",
        })
        with urlopen(requete, timeout=15) as reponse:
            html = reponse.read(400000).decode("utf-8", "replace")
    except Exception:
        return False
    texte = re.sub(r"<script[\s\S]*?</script>", " ", html)
    texte = re.sub(r"<[^>]+>", " ", texte).lower()
    if "incorrecte" in texte or "not found" in texte:
        return False
    return "transaction id" in texte


def initier_paiement(invoice, montant=None):
    """Crée (ou réutilise) une transaction LigdiCash pour une facture.

    Retourne (transaction, pay_url). Le montant est FIGÉ ici : il ne sera
    plus recalculé, et toute écriture de reçu passe par la comparaison avec
    le montant retourné par /confirm.

    La page de paiement est VÉRIFIÉE avant d'être renvoyée : une facture
    LigdiCash dont la page renvoie 404 est abandonnée et une nouvelle est
    créée (la propagation côté LigdiCash est parfois en retard).
    """
    montant = montant_xof(montant if montant is not None else invoice.solde)
    if montant <= 0:
        raise LigdiCashError("Aucun montant à encaisser sur cette facture.", code="montant_nul")

    en_cours = (PayinTransaction.objects
                .filter(invoice=invoice, statut=PayinTransaction.STATUT_PENDING)
                .exclude(pay_url="")
                .order_by("-cree_le")
                .first())
    if en_cours and en_cours.cree_le > timezone.now() - FENETRE_REPRISE:
        if page_paiement_valide(en_cours.pay_url):
            return en_cours, en_cours.pay_url
        # Page morte : on ne la ressert pas, on repart d'une facture neuve.
        en_cours.statut = PayinTransaction.STATUT_NOTCOMPLETED
        en_cours.erreur = "Page de paiement LigdiCash introuvable (404) - relance."
        en_cours.save(update_fields=["statut", "erreur"])

    derniere_erreur = ""
    for _ in range(2):
        transaction = PayinTransaction.objects.create(
            invoice=invoice, montant=montant, statut=PayinTransaction.STATUT_PENDING)
        try:
            token, pay_url = creer_facture(invoice, transaction.transaction_id, montant)
        except LigdiCashError as e:
            transaction.statut = PayinTransaction.STATUT_NOTCOMPLETED
            transaction.erreur = e.message[:255]
            transaction.save(update_fields=["statut", "erreur"])
            raise
        transaction.ligdicash_token = token
        transaction.pay_url = pay_url
        transaction.save(update_fields=["ligdicash_token", "pay_url"])

        if page_paiement_valide(pay_url):
            return transaction, pay_url

        # Page de paiement 404 : on marque la transaction morte et on retente.
        transaction.statut = PayinTransaction.STATUT_NOTCOMPLETED
        transaction.erreur = "Page de paiement LigdiCash introuvable (404)."
        transaction.save(update_fields=["statut", "erreur"])
        derniere_erreur = transaction.erreur

    raise LigdiCashError(
        "La page de paiement LigdiCash est introuvable. Réessayez dans un instant "
        "ou contactez l'agence.",
        code="page_paiement_404", detail=derniere_erreur)


def encaisser(transaction, detail=None):
    """Crée le reçu automatique et solde la facture (montant contrôlé).

    Le montant réellement encaissé est celui renvoyé par /confirm : s'il
    diffère du montant figé, rien n'est enregistré (à traiter en finance).
    """
    invoice = transaction.invoice
    if invoice is None:
        return None
    from apps.finance.models import Invoice, Receipt

    if Receipt.objects.filter(ref_transaction=transaction.transaction_id).exists():
        return None

    detail = detail or {}
    montant_recu = montant_xof(detail.get("montant") or detail.get("amount"))
    if montant_recu and montant_recu != transaction.montant:
        transaction.erreur = f"Montant reçu {montant_recu} <> montant attendu {transaction.montant}."
        transaction.save(update_fields=["erreur"])
        return None

    recu = Receipt.objects.create(
        invoice=invoice,
        montant=transaction.montant,
        moyen=Receipt.MOYEN_MOBILE_MONEY,
        ref_transaction=transaction.transaction_id,
    )
    invoice = Invoice.objects.prefetch_related("lignes", "recus").get(id=invoice.id)
    invoice.statut = Invoice.STATUT_PAYEE if invoice.solde <= 0 else Invoice.STATUT_PARTIELLE
    invoice.save(update_fields=["statut"])

    if invoice.destinataire_email:
        from apps.mailing.services import send_templated_mail

        send_templated_mail(
            "recu_disponible", invoice.destinataire_email,
            {"societe": invoice.destinataire_nom, "numero": recu.numero,
             "montant": f"{float(recu.montant):,.0f}".replace(",", " "),
             "facture_numero": invoice.numero},
            department_slug="finance", client=invoice.client,
        )
    return recu


def appliquer_statut(transaction, statut, detail=None):
    """Applique le statut issu de /confirm et déclenche l'encaissement si payé."""
    detail = detail or {}
    transaction.statut = statut
    if detail.get("operator_name"):
        transaction.operator_name = str(detail["operator_name"])[:100]
    if detail.get("customer"):
        transaction.customer = str(detail["customer"])[:32]
    if detail.get("oreference"):
        transaction.ref_operateur = str(detail["oreference"])[:100]
    if detail.get("request_id"):
        transaction.request_id = str(detail["request_id"])[:64]
    transaction.reponse_brute = detail
    transaction.save()
    if statut == PayinTransaction.STATUT_COMPLETED:
        encaisser(transaction, detail)
    return transaction


def verifier_transaction(transaction):
    """Relit le statut chez LigdiCash (/confirm) et l'applique si besoin.

    Source de vérité unique : le statut renvoyé par l'API, jamais le payload.
    """
    if transaction.statut != PayinTransaction.STATUT_PENDING:
        return transaction
    if not transaction.ligdicash_token:
        return transaction
    data = confirmer(transaction.ligdicash_token)
    if data.get("response_code") != "00":
        return transaction
    statut = data.get("status")
    if statut in dict(PayinTransaction.STATUTS):
        appliquer_statut(transaction, statut, data)
    return transaction
