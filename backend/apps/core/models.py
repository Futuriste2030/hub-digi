"""Modèles transverses — SPEC §10/§11 : AuditLog, Notification."""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=50)  # create/update/delete/validate/...
    objet = models.CharField(max_length=255, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"{self.cree_le:%d/%m/%Y %H:%M} {self.user} {self.action} {self.objet}"


class Notification(models.Model):
    destinataire = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    titre = models.CharField(max_length=255)
    texte = models.TextField(blank=True)
    lue = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"{self.titre} -> {self.destinataire}"


class GroupeChat(models.Model):
    """Groupes style Slack : un groupe général (tout le monde) + sous-groupes.
    Création réservée au super admin (Paramètres > Chat)."""

    nom = models.CharField(max_length=100, unique=True)
    general = models.BooleanField(default=False, help_text="Groupe général : tous les internes en sont membres")
    membres = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="groupes_chat")
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="groupes_crees")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-general", "nom"]

    def __str__(self):
        return f"{'# ' if self.general else ''}{self.nom}"

    def est_membre(self, user):
        if not user or not user.is_authenticated:
            return False
        if user.role == "super_admin":
            return True
        if self.general:
            return user.role != "client"
        return self.membres.filter(id=user.id).exists()


class DirectMessage(models.Model):
    """Chat interne : messages directs entre users (Topbar) ou de groupe (groupe set)."""

    expediteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages_envoyes")
    destinataire = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="messages_recus")
    groupe = models.ForeignKey(GroupeChat, null=True, blank=True, on_delete=models.CASCADE, related_name="messages")
    texte = models.TextField()
    lu = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return f"{self.expediteur} -> {self.destinataire}"


class SiteSettings(models.Model):
    """Paramètres société (singleton id=1) — repris sur factures/reçus (SPEC §5.1)."""

    raison = models.CharField(max_length=255, default="Digi Com & Technologies")
    nif = models.CharField(max_length=50, default="081234567A")
    rccm = models.CharField(max_length=50, default="ML-BKO-2021-B-1234")
    adresse = models.CharField(max_length=255, default="Sotuba ACI-2000, Bamako")
    phone = models.CharField(max_length=50, default="(+223) 70 16 33 86")
    email = models.EmailField(default="contact@digicom.ml")
    delai_paiement = models.CharField(max_length=50, default="30 jours")
    signataire = models.CharField(max_length=100, default="La Direction Financière")
    # Tampons société : finance (factures/devis/reçus) + juridique (contrats/litiges),
    # chacun avec sa signature superposée dans le design. Secrétariat : cachet seul
    # (courriers signés à la main après impression, pas de signature importée).
    cachet_finance = models.ImageField(upload_to="cachets/", null=True, blank=True)
    signature_finance = models.ImageField(upload_to="cachets/", null=True, blank=True)
    cachet_juridique = models.ImageField(upload_to="cachets/", null=True, blank=True)
    signature_juridique = models.ImageField(upload_to="cachets/", null=True, blank=True)
    cachet_secretariat = models.ImageField(upload_to="cachets/", null=True, blank=True)

    def __str__(self):
        return self.raison

    @classmethod
    def instance(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj
