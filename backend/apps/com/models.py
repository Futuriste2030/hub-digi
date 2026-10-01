"""Communication — SPEC §5.3 : Campaign, Publication (calendrier éditorial), Media."""

from django.db import models


class Campaign(models.Model):
    STATUTS = [("brouillon", "Brouillon"), ("en_cours", "En cours"), ("terminee", "Terminée")]

    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="campagnes")
    titre = models.CharField(max_length=255)
    canal = models.CharField(max_length=50, blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    objectifs = models.TextField(blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.titre


class Publication(models.Model):
    STATUTS = [("brouillon", "Brouillon"), ("a_valider", "À valider"), ("programme", "Programmé"), ("publie", "Publié")]

    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="publications")
    campagne = models.ForeignKey(Campaign, null=True, blank=True, on_delete=models.SET_NULL, related_name="publications")
    titre = models.CharField(max_length=255)
    canal = models.CharField(max_length=50, blank=True)  # FB, Insta, TikTok, LinkedIn
    date_pub = models.DateTimeField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    contenu = models.TextField(blank=True)
    a_valider_par_client = models.BooleanField(default=False)

    class Meta:
        ordering = ["date_pub"]

    def __str__(self):
        return self.titre


class Media(models.Model):
    TYPES = [("image", "Image"), ("video", "Vidéo"), ("audio", "Audio"), ("document", "Document")]
    STATUTS = [("a_valider", "À valider"), ("valide", "Validé"), ("rejete", "Rejeté")]

    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="medias")
    nom = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPES, default="image")
    fichier = models.FileField(upload_to="medias/", null=True, blank=True)
    url = models.URLField(blank=True, help_text="Lien externe (vidéo lourde : 0 octet sur le VPS)")
    statut = models.CharField(max_length=20, choices=STATUTS, default="a_valider")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.nom


class Communique(models.Model):
    """Communiqué de presse de l'agence et de ses clients."""

    STATUTS = [("brouillon", "Brouillon"), ("publie", "Publié")]

    titre = models.CharField(max_length=255)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="communiques")
    diffusion = models.CharField(max_length=255, blank=True)
    contenu = models.TextField(blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.titre
