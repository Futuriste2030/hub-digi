"""Fournisseurs — achats : fiches fournisseurs, factures d'achat, paiements.

Périmètre Finance (SPEC §5.7 étendu) : le miroir des Clients côté dépenses.
Références uniques via references.generer_reference (compteur par type et année) :
BDC-SLUG-AAAA-NNNN, BDL-SLUG-AAAA-NNNN, ACHAT-SLUG-AAAA-NNNN, RECU-F-SLUG-AAAA-NNNN.
"""

from django.db import models
from django.utils import timezone


class CompteurReference(models.Model):
    """Compteur séquentiel par (préfixe, année) — voir references.py."""

    prefixe = models.CharField(max_length=10)
    annee = models.IntegerField()
    dernier = models.IntegerField(default=0)

    class Meta:
        unique_together = [("prefixe", "annee")]

    def __str__(self):
        return f"{self.prefixe}-{self.annee} : {self.dernier}"


class Fournisseur(models.Model):
    STATUT_ACTIF = "actif"
    STATUT_INACTIF = "inactif"
    STATUT_PROSPECT = "prospect"
    STATUTS = [(STATUT_ACTIF, "Actif"), (STATUT_INACTIF, "Inactif"), (STATUT_PROSPECT, "Prospect")]

    nom_societe = models.CharField(max_length=255)
    categorie = models.CharField(max_length=100, blank=True, help_text="Ex. Imprimerie, Hébergement, Matériel")
    contact = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    adresse = models.TextField(blank=True)
    conditions_paiement = models.CharField(max_length=255, blank=True, help_text="Ex. 30 jours, comptant")
    statut = models.CharField(max_length=10, choices=STATUTS, default=STATUT_ACTIF)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom_societe"]

    def __str__(self):
        return self.nom_societe

    @property
    def total_achats(self):
        return sum((f.total or 0) for f in self.factures.all())

    @property
    def total_paye(self):
        return sum((p.montant or 0) for f in self.factures.all() for p in f.paiements.all())

    @property
    def solde_du(self):
        return (self.total_achats or 0) - (self.total_paye or 0)


class FactureFournisseur(models.Model):
    STATUT_BROUILLON = "brouillon"
    STATUT_RECUE = "recue"
    STATUT_VALIDEE = "validee"
    STATUT_PAYEE = "payee"
    STATUT_PARTIELLE = "partielle"
    STATUTS = [
        (STATUT_BROUILLON, "Brouillon"), (STATUT_RECUE, "Reçue"), (STATUT_VALIDEE, "Validée"),
        (STATUT_PAYEE, "Payée"), (STATUT_PARTIELLE, "Partielle"),
    ]

    fournisseur = models.ForeignKey(Fournisseur, on_delete=models.CASCADE, related_name="factures")
    commande = models.ForeignKey("BonCommande", null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="factures",
                                 help_text="Bon de commande d'origine (conversion)")
    numero = models.CharField(max_length=80, unique=True, blank=True)
    reference_fournisseur = models.CharField(max_length=80, blank=True, help_text="N° facture du fournisseur")
    objet = models.CharField(max_length=255, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_RECUE)
    echeance = models.DateField(null=True, blank=True)
    fichier = models.FileField(upload_to="achats/", null=True, blank=True, help_text="Scan facture PDF")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Achat {self.id}"

    def save(self, *args, **kwargs):
        if not self.numero:
            from .references import generer_reference
            self.numero = generer_reference("ACHAT", self.fournisseur.nom_societe)
        super().save(*args, **kwargs)

    @property
    def total(self):
        return sum((l.montant or 0) * (l.quantite or 0) for l in self.lignes.all())

    @property
    def paye(self):
        return sum((p.montant or 0) for p in self.paiements.all())

    @property
    def solde(self):
        return (self.total or 0) - (self.paye or 0)


class LigneFactureFournisseur(models.Model):
    facture = models.ForeignKey(FactureFournisseur, on_delete=models.CASCADE, related_name="lignes")
    description = models.CharField(max_length=255)
    quantite = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.description} x{self.quantite}"


class PaiementFournisseur(models.Model):
    MOYENS = [("especes", "Espèces"), ("virement", "Virement"), ("mobile_money", "Mobile Money"), ("carte", "Carte")]

    facture = models.ForeignKey(FactureFournisseur, on_delete=models.CASCADE, related_name="paiements")
    numero = models.CharField(max_length=80, unique=True, blank=True)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    moyen = models.CharField(max_length=20, choices=MOYENS, default="virement")
    ref_transaction = models.CharField(max_length=100, blank=True)
    date = models.DateField(default=timezone.localdate)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.numero or f"{self.montant} F — {self.facture.numero}"

    def save(self, *args, **kwargs):
        if not self.numero:
            from .references import generer_reference
            self.numero = generer_reference("RECU-F", self.facture.fournisseur.nom_societe)
        super().save(*args, **kwargs)


class BonCommande(models.Model):
    """Bon de commande d'achat : brouillon -> validée -> envoyée -> livrée -> facturée."""

    STATUT_BROUILLON = "brouillon"
    STATUT_VALIDEE = "validee"
    STATUT_ENVOYEE = "envoyee"
    STATUT_PARTIELLE = "partiellement_livree"
    STATUT_LIVREE = "livree"
    STATUT_FACTUREE = "facturee"
    STATUT_ANNULEE = "annulee"
    STATUTS = [
        (STATUT_BROUILLON, "Brouillon"), (STATUT_VALIDEE, "Validée"),
        (STATUT_ENVOYEE, "Envoyée"), (STATUT_PARTIELLE, "Partiellement livrée"),
        (STATUT_LIVREE, "Livrée"), (STATUT_FACTUREE, "Facturée"),
        (STATUT_ANNULEE, "Annulée"),
    ]

    fournisseur = models.ForeignKey(Fournisseur, on_delete=models.CASCADE, related_name="commandes")
    numero = models.CharField(max_length=80, unique=True, blank=True)
    objet = models.CharField(max_length=255, blank=True)
    statut = models.CharField(max_length=25, choices=STATUTS, default=STATUT_BROUILLON)
    livraison_prevue = models.DateField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Commande {self.id}"

    def save(self, *args, **kwargs):
        if not self.numero:
            from .references import generer_reference
            self.numero = generer_reference("BDC", self.fournisseur.nom_societe)
        super().save(*args, **kwargs)

    @property
    def total(self):
        return sum((l.montant or 0) * (l.quantite or 0) for l in self.lignes.all())

    @property
    def total_livre(self):
        return sum((l.montant or 0) * (l.quantite_livree or 0) for l in self.lignes.all())


class LigneBonCommande(models.Model):
    commande = models.ForeignKey(BonCommande, on_delete=models.CASCADE, related_name="lignes")
    description = models.CharField(max_length=255)
    quantite = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    quantite_livree = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.description} x{self.quantite}"

    @property
    def reste(self):
        return (self.quantite or 0) - (self.quantite_livree or 0)


class BonLivraison(models.Model):
    """Bon de livraison : constate la réception (lié à une commande ou libre)."""

    STATUT_BROUILLON = "brouillon"
    STATUT_VALIDE = "valide"
    STATUTS = [(STATUT_BROUILLON, "Brouillon"), (STATUT_VALIDE, "Validé")]

    fournisseur = models.ForeignKey(Fournisseur, on_delete=models.CASCADE, related_name="livraisons")
    commande = models.ForeignKey(BonCommande, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="livraisons")
    numero = models.CharField(max_length=80, unique=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_BROUILLON)
    date_livraison = models.DateField(default=timezone.localdate)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Livraison {self.id}"

    def save(self, *args, **kwargs):
        if not self.numero:
            from .references import generer_reference
            self.numero = generer_reference("BDL", self.fournisseur.nom_societe)
        super().save(*args, **kwargs)

    @property
    def total(self):
        return sum((l.montant or 0) * (l.quantite or 0) for l in self.lignes.all())


class LigneBonLivraison(models.Model):
    livraison = models.ForeignKey(BonLivraison, on_delete=models.CASCADE, related_name="lignes")
    ligne_commande = models.ForeignKey(LigneBonCommande, null=True, blank=True,
                                       on_delete=models.SET_NULL, related_name="livraisons")
    description = models.CharField(max_length=255)
    quantite = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.description} x{self.quantite}"
