"""Tickets + Secrétariat — SPEC §5.2/§7 : Ticket, TicketMessage, TicketApproval, Courrier, Document, Reunion, Decharge."""

from django.conf import settings
from django.db import models
from django.utils import timezone


def numero_ticket():
    annee = timezone.now().year
    dernier = Ticket.objects.filter(numero__startswith=f"TICK-{annee}-").order_by("-numero").first()
    seq = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
    return f"TICK-{annee}-{seq:04d}"


class Ticket(models.Model):
    NOUVEAU = "nouveau"
    QUALIFIE = "qualifie"
    ATTENTE_AVAL = "en_attente_aval"
    APPROUVE = "approuve"
    REPONDU = "repondu"
    CLOS = "clos"
    REJETE = "rejete"
    STATUTS = [
        (NOUVEAU, "Nouveau"), (QUALIFIE, "Qualifié"), (ATTENTE_AVAL, "En attente d'aval"),
        (APPROUVE, "Approuvé"), (REPONDU, "Répondu"), (CLOS, "Clos"), (REJETE, "Rejeté"),
    ]
    PRIORITES = [("basse", "Basse"), ("normale", "Normale"), ("haute", "Haute"), ("critique", "Critique")]

    numero = models.CharField(max_length=20, unique=True, blank=True)
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="tickets")
    project = models.ForeignKey("projects_dev.Project", null=True, blank=True, on_delete=models.SET_NULL)
    dept_assigne = models.CharField(max_length=100, blank=True)
    categorie = models.CharField(max_length=100, blank=True)
    priorite = models.CharField(max_length=20, choices=PRIORITES, default="normale")
    statut = models.CharField(max_length=20, choices=STATUTS, default=NOUVEAU)
    sujet = models.CharField(max_length=255)
    message = models.TextField()
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Ticket {self.id}"

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = numero_ticket()
        super().save(*args, **kwargs)


class TicketMessage(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    is_internal = models.BooleanField(default=True)
    message = models.TextField()
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cree_le"]


class TicketApproval(models.Model):
    DECISIONS = [("approuve", "Approuvé"), ("modifie", "Modifié"), ("rejete", "Rejeté")]

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="approvals")
    demandeur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="avals_demandes")
    valideur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="avals_donnes")
    decision = models.CharField(max_length=20, choices=DECISIONS, blank=True)
    commentaire = models.TextField(blank=True)
    reponse_proposee = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Aval {self.ticket} ({self.decision or 'en attente'})"


class Courrier(models.Model):
    SENS_ENTRANT = "entrant"
    SENS_SORTANT = "sortant"
    STATUT_BROUILLON = "brouillon"
    STATUT_ENVOYE = "envoye"
    STATUT_RECU = "recu"
    STATUT_TRAITE = "traite"
    STATUT_ARCHIVE = "archive"
    STATUTS = [(STATUT_BROUILLON, "Brouillon"), (STATUT_ENVOYE, "Envoyé"), (STATUT_RECU, "Reçu"),
               (STATUT_TRAITE, "Traité"), (STATUT_ARCHIVE, "Archivé")]

    reference = models.CharField(max_length=50, unique=True, blank=True)
    sens = models.CharField(max_length=10, choices=[(SENS_ENTRANT, "Entrant"), (SENS_SORTANT, "Sortant")], default=SENS_ENTRANT)
    objet = models.CharField(max_length=255)
    expediteur = models.CharField(max_length=255, blank=True)
    destinataire = models.CharField(max_length=255, blank=True)
    date = models.DateField(default=timezone.localdate)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_BROUILLON)
    contenu = models.TextField(blank=True)

    class Meta:
        ordering = ["-date"]

    def save(self, *args, **kwargs):
        if not self.reference:
            n = Courrier.objects.count() + 1
            self.reference = f"COUR-{timezone.now().year}-{n:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference


class DocumentSecretariat(models.Model):
    """Offres techniques/commerciales, lettres, attestations… — rédaction libre
    Secrétariat (éditeur riche + en-tête + cachet, comme contrats/communiqués)."""

    TYPE_OFFRE_TECHNIQUE = "offre_technique"
    TYPE_OFFRE_COMMERCIALE = "offre_commerciale"
    TYPE_LETTRE = "lettre"
    TYPE_ATTESTATION = "attestation"
    TYPE_NOTE = "note"
    TYPE_AUTRE = "autre"
    TYPES = [
        (TYPE_OFFRE_TECHNIQUE, "Offre technique"),
        (TYPE_OFFRE_COMMERCIALE, "Offre commerciale"),
        (TYPE_LETTRE, "Lettre"),
        (TYPE_ATTESTATION, "Attestation"),
        (TYPE_NOTE, "Note de service"),
        (TYPE_AUTRE, "Autre document"),
    ]
    PREFIXES = {
        TYPE_OFFRE_TECHNIQUE: "OT",
        TYPE_OFFRE_COMMERCIALE: "OC",
        TYPE_LETTRE: "LET",
        TYPE_ATTESTATION: "ATT",
        TYPE_NOTE: "NOTE",
        TYPE_AUTRE: "DOC",
    }

    STATUT_BROUILLON = "brouillon"
    STATUT_VALIDE = "valide"
    STATUT_ENVOYE = "envoye"
    STATUT_ARCHIVE = "archive"
    STATUTS = [(STATUT_BROUILLON, "Brouillon"), (STATUT_VALIDE, "Validé"),
               (STATUT_ENVOYE, "Envoyé"), (STATUT_ARCHIVE, "Archivé")]

    reference = models.CharField(max_length=50, unique=True, blank=True)
    type = models.CharField(max_length=30, choices=TYPES, default=TYPE_LETTRE)
    titre = models.CharField(max_length=255)
    destinataire = models.CharField(max_length=255, blank=True)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="documents_secretariat")
    contenu = models.TextField(blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_BROUILLON)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cree_le"]

    def save(self, *args, **kwargs):
        if not self.reference:
            annee = timezone.now().year
            prefixe = self.PREFIXES.get(self.type, "DOC")
            dernier = DocumentSecretariat.objects.filter(
                reference__startswith=f"{prefixe}-{annee}-").order_by("-reference").first()
            seq = int(dernier.reference.rsplit("-", 1)[1]) + 1 if dernier else 1
            self.reference = f"{prefixe}-{annee}-{seq:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference


class Decharge(models.Model):
    """Décharge archivée : scan compressé + provenance + date (registre Secrétariat)."""

    reference = models.CharField(max_length=50, unique=True, blank=True)
    provenance = models.CharField(max_length=255, help_text="Qui a remis : personne / service / société")
    objet = models.CharField(max_length=255, help_text="Ce qui est déchargé : montant, documents, matériel…")
    montant = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date_recue = models.DateField(default=timezone.localdate)
    image = models.ImageField(upload_to="decharges/", help_text="Scan compressé auto (JPEG 1600px q70)")
    poids_ko = models.IntegerField(default=0, help_text="Poids après compression (Ko)")
    commentaire = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_recue"]

    def save(self, *args, **kwargs):
        if not self.reference:
            n = Decharge.objects.count() + 1
            self.reference = f"DCH-{timezone.now().year}-{n:04d}"
        if self.image:
            a_compresser = self.pk is None
            if not a_compresser:
                try:
                    ancien = Decharge.objects.get(pk=self.pk).image
                    a_compresser = (ancien.name != self.image.name)
                except Decharge.DoesNotExist:
                    a_compresser = True
            if a_compresser:
                from .images import compresser_image

                nom, contenu = compresser_image(self.image.name, self.image.file)
                if contenu is not None:
                    self.image.save(nom, contenu, save=False)
        super().save(*args, **kwargs)
        if self.image:
            try:
                poids = self.image.size // 1024
                if poids != self.poids_ko:
                    Decharge.objects.filter(pk=self.pk).update(poids_ko=poids)
                    self.poids_ko = poids
            except Exception:
                pass

    def __str__(self):
        return self.reference


class Reunion(models.Model):
    PLANIFIEE = "planifiee"
    PV_REDACTION = "pv_redaction"
    CLOTUREE = "cloturee"
    STATUTS = [(PLANIFIEE, "Planifiée"), (PV_REDACTION, "PV en rédaction"), (CLOTUREE, "Clôturée")]

    titre = models.CharField(max_length=255)
    date = models.DateField()
    heure = models.TimeField(null=True, blank=True)
    lieu = models.CharField(max_length=255, blank=True)
    participants = models.TextField(blank=True, help_text="Noms séparés par des virgules (convocation mail)")
    statut = models.CharField(max_length=20, choices=STATUTS, default=PLANIFIEE)
    ordre_du_jour = models.TextField(blank=True)
    pv = models.TextField(blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.titre} ({self.date})"


class DecisionReunion(models.Model):
    reunion = models.ForeignKey(Reunion, on_delete=models.CASCADE, related_name="decisions")
    texte = models.CharField(max_length=500)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    echeance = models.DateField()
    tache = models.ForeignKey("projects_dev.Task", null=True, blank=True, on_delete=models.SET_NULL)
    cree_le = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.texte[:60]
