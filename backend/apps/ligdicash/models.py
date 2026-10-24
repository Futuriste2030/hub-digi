"""LigdiCash — payin avec redirection (SPEC §5.7) : traçabilité des paiements mobile money.

Règle LigdiCash : le `token` renvoyé à la création n'est PAS celui du callback.
On ne peut donc pas réconcilier les deux. D'où le `transaction_id` maison
généré ici, injecté dans `custom_data` : il est stable, présent dans le
callback et affiché dans le dashboard LigdiCash.

Le `ligdicash_token` stocké ici est le token de CRÉATION : c'est le seul qui
permet de relier une réponse de /confirm à une commande du HUB.
"""

import uuid

from django.db import models
from django.utils import timezone


def generer_transaction_id():
    """Identifiant marchand : lisible (date), non séquentiel (6 hex aléatoires).

    Évite d'exposer le volume de transactions côté client (le format
    `order_1`, `order_2` est discouraged par la doc LigdiCash).
    """
    return f"PAI-{timezone.now():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


class PayinTransaction(models.Model):
    STATUT_PENDING = "pending"
    STATUT_COMPLETED = "completed"
    STATUT_NOTCOMPLETED = "notcompleted"
    STATUTS = [
        (STATUT_PENDING, "En attente"),
        (STATUT_COMPLETED, "Payé"),
        (STATUT_NOTCOMPLETED, "Non abouti"),
    ]

    transaction_id = models.CharField(max_length=64, unique=True, editable=False,
                                      help_text="Identifiant marchand, passé dans custom_data.")
    invoice = models.ForeignKey("finance.Invoice", null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="paiements_ligdicash",
                                 help_text="Facture réglée (SET_NULL : la trace survit à la facture).")
    montant = models.IntegerField(help_text="Montant figé au moment de l'initiation (XOF).")
    devise = models.CharField(max_length=8, default="XOF")
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_PENDING)
    ligdicash_token = models.CharField(max_length=512, blank=True,
                                       help_text="Token de CRÉATION : seul valide pour /confirm.")
    pay_url = models.TextField(blank=True, help_text="Page de paiement LigdiCash (jamais dans une iframe).")
    operator_name = models.CharField(max_length=100, blank=True)
    customer = models.CharField(max_length=32, blank=True, help_text="Numéro payeur (indicatif pays).")
    ref_operateur = models.CharField(max_length=100, blank=True, help_text="oreference de l'opérateur.")
    request_id = models.CharField(max_length=64, blank=True, help_text="request_id LigdiCash (support).")
    reponse_brute = models.JSONField(default=dict, blank=True, help_text="Réponse /confirm conservée (audit).")
    erreur = models.CharField(max_length=255, blank=True,
                               help_text="Anomalie (montant reçu <> attendu, refus API…).")
    callback_recu_le = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cree_le"]
        indexes = [
            models.Index(fields=["invoice", "statut"]),
            models.Index(fields=["statut", "cree_le"]),
        ]

    def __str__(self):
        numero = self.invoice.numero if self.invoice_id else "—"
        return f"{self.transaction_id} — {numero} ({self.montant} {self.devise})"

    def save(self, *args, **kwargs):
        if not self.transaction_id:
            self.transaction_id = generer_transaction_id()
        super().save(*args, **kwargs)


class CallbackLigdiCash(models.Model):
    """Journal BRUT de tout ce qui arrive sur le callback LigdiCash.

    LigdiCash poste 2 fois par événement (JSON puis form-urlencoded) et peut
    sonder l'endpoint avant toute transaction réelle. On conserve TOUT ce qui
    entre : corps brut, en-têtes, IP, et la réponse que nous avons renvoyée.

    C'est la traçabilité demandée par l'équipe LigdiCash lors de la validation
    de l'intégration (« le contenu des requêtes effectivement reçues »).
    Un callback sans transaction_id connue est donc journalisé aussi.
    """

    recu_le = models.DateTimeField(auto_now_add=True, db_index=True)
    content_type = models.CharField(max_length=120, blank=True)
    corps_brut = models.TextField(blank=True, help_text="Corps exact recu.")
    payload = models.JSONField(default=dict, blank=True, help_text="Corps decode (JSON).")
    entetes = models.JSONField(default=dict, blank=True, help_text="En-tetes retenus.")
    transaction_id = models.CharField(max_length=64, blank=True, db_index=True)
    statut_reponse = models.CharField(max_length=8, blank=True)
    reponse = models.TextField(blank=True, help_text="Reponse renvoyee au client.")
    source_ip = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-recu_le"]

    def __str__(self):
        return f"{self.recu_le:%Y-%m-%d %H:%M:%S} | {self.transaction_id or '(sans id)'} | {self.statut_reponse}"
