"""Client — SPEC §4/§11 : fiche 360° (overview agrégée dans la vue)."""

from django.db import models
from django.utils.text import slugify


class Client(models.Model):
    STATUT_PROSPECT = "prospect"
    STATUT_CLIENT = "client"
    STATUTS = [(STATUT_PROSPECT, "Prospect"), (STATUT_CLIENT, "Client")]

    nom_societe = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True,
                            help_text="Personnalise l'URL du portail : /espace/<slug>/<code>")
    code = models.CharField(max_length=4, unique=True, blank=True,
                            help_text="Identifiant unique 4 chiffres du portail client")
    contact = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    adresse = models.TextField(blank=True)
    statut = models.CharField(max_length=10, choices=STATUTS, default=STATUT_PROSPECT)
    est_interne = models.BooleanField(
        default=False,
        help_text="Client interne (ex. Digi Com elle-même) : géré dans le hub, "
                  "sans compte ni espace client (/espace).",
    )
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom_societe"]

    def __str__(self):
        return self.nom_societe

    def save(self, *args, **kwargs):
        import random

        if not self.slug:
            base = slugify(self.nom_societe) or "client"
            slug = base
            i = 2
            while Client.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        if not self.code:
            for _ in range(50):
                code = f"{random.randint(1000, 9999)}"
                if not Client.objects.filter(code=code).exclude(pk=self.pk).exists():
                    self.code = code
                    break
        super().save(*args, **kwargs)
