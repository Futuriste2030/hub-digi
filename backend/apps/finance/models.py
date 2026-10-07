"""Finance — SPEC §5.7/§11 : Devis, Invoice, Receipt, Expense, Paie.
Numérotation : PREFIXE-SLUGCLIENT-JJ-MM-AAAA-ID (ex. FACTURE-ORANGE-MALI-16-09-2026-12).
Tirets au lieu de slashs : le numéro circule dans les URLs et les noms de fichiers."""

import uuid

from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def slug_client(nom):
    return (slugify(nom or "") or "client").upper()


def numero_document(prefixe, client_nom, date, identifiant):
    jour = date.strftime("%d-%m-%Y") if hasattr(date, "strftime") else str(date)
    return f"{prefixe}-{slug_client(client_nom)}-{jour}-{identifiant}"


def reserver_numero_temporaire():
    """Placeholder unique pour l'INSERT (l'id n'existe pas encore)."""
    return f"TEMP-{uuid.uuid4().hex[:12].upper()}"


class Devis(models.Model):
    STATUT_ATTENTE = "en_attente"
    STATUT_ACCEPTE = "accepte"
    STATUT_REFUSE = "refuse"
    STATUTS = [(STATUT_ATTENTE, "En attente"), (STATUT_ACCEPTE, "Accepté"), (STATUT_REFUSE, "Refusé")]

    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="devis")
    project = models.ForeignKey("projects_dev.Project", null=True, blank=True, on_delete=models.SET_NULL)
    numero = models.CharField(max_length=80, unique=True, blank=True)
    objet = models.CharField(max_length=255)
    validite = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_ATTENTE)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Devis {self.id} — {self.objet}"

    def save(self, *args, **kwargs):
        nouveau = self.pk is None and not self.numero
        if nouveau:
            self.numero = reserver_numero_temporaire()
        super().save(*args, **kwargs)
        if nouveau:
            date = timezone.localdate(self.cree_le) if self.cree_le else timezone.localdate()
            self.numero = numero_document("DEVIS", self.client.nom_societe, date, self.pk)
            super().save(update_fields=["numero"])

    @property
    def total(self):
        return sum((l.montant or 0) * (l.quantite or 0) for l in self.lignes.all())


class DevisLigne(models.Model):
    devis = models.ForeignKey(Devis, on_delete=models.CASCADE, related_name="lignes")
    description = models.CharField(max_length=255)
    quantite = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # prix unitaire XOF

    def __str__(self):
        return f"{self.description} x{self.quantite}"


class Invoice(models.Model):
    STATUT_BROUILLON = "brouillon"
    STATUT_VALIDEE = "validee"
    STATUT_ENVOYEE = "envoyee"
    STATUT_PAYEE = "payee"
    STATUT_PARTIELLE = "partielle"
    STATUT_IMPAYEE = "impayee"
    STATUTS = [
        (STATUT_BROUILLON, "Brouillon"), (STATUT_VALIDEE, "Validée"), (STATUT_ENVOYEE, "Envoyée"),
        (STATUT_PAYEE, "Payée"), (STATUT_PARTIELLE, "Partielle"), (STATUT_IMPAYEE, "Impayée"),
    ]

    client = models.ForeignKey("clients.Client", null=True, blank=True,
                                   on_delete=models.CASCADE, related_name="factures",
                                   help_text="NULL pour les factures formations (voir inscription).")
    inscription = models.ForeignKey("formations.InscriptionFormation", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="factures",
                                    help_text="Inscription formation facturée (factures formations).")
    project = models.ForeignKey("projects_dev.Project", null=True, blank=True, on_delete=models.SET_NULL)
    numero = models.CharField(max_length=80, unique=True, blank=True)
    tva_active = models.BooleanField(default=False, help_text="TVA 18 % applicable (désactivée par défaut : pas de TVA au Mali)")
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_BROUILLON)
    envoyee_le = models.DateTimeField(null=True, blank=True, help_text="Passage en envoyée (clic WhatsApp ou envoi mail).")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Facture {self.id}"

    def save(self, *args, **kwargs):
        nouveau = self.pk is None and not self.numero
        if nouveau:
            self.numero = reserver_numero_temporaire()
        super().save(*args, **kwargs)
        if nouveau:
            date = timezone.localdate(self.cree_le) if self.cree_le else timezone.localdate()
            self.numero = numero_document("FACTURE", slug_client(self.destinataire_nom), date, self.pk)
            super().save(update_fields=["numero"])

    @property
    def destinataire_nom(self):
        """Nom affiché : société cliente, ou participant formation, ou repli."""
        if self.client_id and getattr(self.client, "nom_societe", ""):
            return self.client.nom_societe
        insc = getattr(self, "inscription", None)
        if insc is not None and getattr(insc, "participant", None) is not None:
            return insc.participant.full_name
        return "Formation"

    @property
    def destinataire_email(self):
        if self.client_id and getattr(self.client, "email", ""):
            return self.client.email
        insc = getattr(self, "inscription", None)
        if insc is not None and getattr(insc, "participant", None) is not None:
            return insc.participant.email
        return ""

    @property
    def destinataire_phone(self):
        if self.client_id and getattr(self.client, "phone", ""):
            return self.client.phone
        insc = getattr(self, "inscription", None)
        if insc is not None and getattr(insc, "participant", None) is not None:
            return insc.participant.phone
        return ""

    @property
    def total(self):
        return sum((l.montant or 0) * (l.quantite or 0) for l in self.lignes.all())

    @property
    def paye(self):
        return sum((r.montant or 0) for r in self.recus.all())

    @property
    def solde(self):
        return (self.total or 0) - (self.paye or 0)


class InvoiceLigne(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lignes")
    description = models.CharField(max_length=255)
    quantite = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.description} x{self.quantite}"


class Receipt(models.Model):
    MOYEN_ESPECES = "especes"
    MOYEN_VIREMENT = "virement"
    MOYEN_MOBILE_MONEY = "mobile_money"
    MOYENS = [(MOYEN_ESPECES, "Espèces"), (MOYEN_VIREMENT, "Virement"), (MOYEN_MOBILE_MONEY, "Mobile Money")]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="recus")
    numero = models.CharField(max_length=80, unique=True, blank=True)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    moyen = models.CharField(max_length=20, choices=MOYENS, default=MOYEN_ESPECES)
    ref_transaction = models.CharField(max_length=100, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Reçu {self.id}"

    def save(self, *args, **kwargs):
        nouveau = self.pk is None and not self.numero
        if nouveau:
            self.numero = reserver_numero_temporaire()
        super().save(*args, **kwargs)
        if nouveau:
            date = timezone.localdate(self.cree_le) if self.cree_le else timezone.localdate()
            self.numero = numero_document("RECU", slug_client(self.invoice.destinataire_nom), date, self.pk)
            super().save(update_fields=["numero"])


class Expense(models.Model):
    MOYENS = [("especes", "Espèces"), ("virement", "Virement"), ("mobile_money", "Mobile Money"), ("carte", "Carte")]

    libelle = models.CharField(max_length=255)
    departement = models.CharField(max_length=100, default="Administration")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    moyen = models.CharField(max_length=20, choices=MOYENS, default="especes")
    date = models.DateField(default=timezone.localdate)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.libelle} ({self.montant} F)"


class FichePaie(models.Model):
    STATUT_BROUILLON = "brouillon"
    STATUT_CLOTUREE = "cloturee"
    STATUTS = [(STATUT_BROUILLON, "Brouillon"), (STATUT_CLOTUREE, "Clôturée")]

    mois_idx = models.IntegerField()  # 0 = Janvier
    annee = models.IntegerField()
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_BROUILLON)
    cachet = models.ImageField(upload_to="cachets/", null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-annee", "-mois_idx"]
        unique_together = [("mois_idx", "annee")]

    def __str__(self):
        return f"Paie {self.mois_idx + 1:02d}/{self.annee} ({self.statut})"


class LignePaie(models.Model):
    STATUT_ATTENTE = "en_attente"
    STATUT_PAYE = "paye"
    STATUTS = [(STATUT_ATTENTE, "En attente"), (STATUT_PAYE, "Payé")]

    fiche = models.ForeignKey(FichePaie, on_delete=models.CASCADE, related_name="lignes")
    numero = models.CharField(max_length=30, blank=True)
    departement = models.CharField(max_length=100, default="Administration")
    prenom = models.CharField(max_length=100, blank=True)
    nom = models.CharField(max_length=100, blank=True)
    fonction = models.CharField(max_length=100, blank=True)
    montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_ATTENTE)
    date = models.CharField(max_length=20, blank=True)  # JJ/MM/AAAA ou —
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["numero"]

    def __str__(self):
        return self.numero or f"Ligne {self.id}"

    def save(self, *args, **kwargs):
        if not self.numero and self.fiche_id:
            mm = f"{self.fiche.mois_idx + 1:02d}"
            n = self.fiche.lignes.count() + 1
            self.numero = f"PAY-{self.fiche.annee}-{mm}-{n:03d}"
        super().save(*args, **kwargs)
