"""Mailing multi-expéditeurs — SPEC §8 : EmailIdentity par département + MailTemplate + SentMail."""

from django.core.mail import send_mail
from django.db import models

from apps.core.tasks import envoyer_mail_async


class EmailIdentity(models.Model):
    department = models.OneToOneField("departments.Department", on_delete=models.CASCADE, related_name="email_identity")
    from_address = models.EmailField()
    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.IntegerField(default=587)
    smtp_user = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)  # prod : champ chiffré (fernet)
    signature = models.TextField(blank=True)
    use_tls = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.department} <{self.from_address}>"


class MailTemplate(models.Model):
    """Template nommé par cas d'usage — SPEC §8 : variables {{ nom }} rendues à l'envoi."""

    key = models.SlugField(max_length=100, unique=True)  # ex. facture_disponible
    nom = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    body_html = models.TextField(help_text="Contenu intérieur uniquement : la mise en page charte (header marine, footer, bouton) est appliquée automatiquement à l'envoi.")
    actif = models.BooleanField(default=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} — {self.nom}"

    def rendre(self, contexte):
        from django.template import Context, Template

        return (
            Template(self.subject).render(Context(contexte or {})),
            Template(self.body_html).render(Context(contexte or {})),
        )


class SentMail(models.Model):
    STATUT_ENVOYE = "envoye"
    STATUT_ECHEC = "echec"
    STATUTS = [(STATUT_ENVOYE, "Envoyé"), (STATUT_ECHEC, "Échec")]

    identity = models.ForeignKey(EmailIdentity, null=True, on_delete=models.SET_NULL, related_name="mails")
    to = models.EmailField()
    subject = models.CharField(max_length=255)
    body_html = models.TextField(blank=True)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL)
    ticket = models.ForeignKey("secretariat_tickets.Ticket", null=True, blank=True, on_delete=models.SET_NULL)
    project = models.ForeignKey("projects_dev.Project", null=True, blank=True, on_delete=models.SET_NULL)
    statut = models.CharField(max_length=20, choices=STATUTS, default=STATUT_ENVOYE)
    erreur = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def expedier(self):
        """Envoi réel (console en dev) + traçabilité. Appelé par la tâche Celery.
        Tout mail part avec le layout charte (comme le reçu) : si le corps n'est
        pas déjà un document HTML complet, on l'enveloppe (texte brut -> échappé).
        Anti-spam : version texte brut systématique (les mails 100 % HTML sont
        pénalisés) + From avec nom affiché « Digi Com & Technologies »."""
        from django.utils.html import strip_tags

        from apps.mailing.layout import ACCENT_DEFAUT, mise_en_page

        corps = self.body_html or ""
        if "<html" not in corps.lower():
            if "<" not in corps:
                from django.utils.html import escape

                corps = escape(corps).replace("\n", "<br>")
            corps = mise_en_page(self.subject, corps, ACCENT_DEFAUT)
            self.body_html = corps
        adresse = self.identity.from_address if self.identity else None
        expediteur = f"Digi Com & Technologies <{adresse}>" if adresse else None
        texte_brut = strip_tags(corps).replace("&nbsp;", " ").strip() or self.subject
        try:
            send_mail(self.subject, texte_brut, expediteur,
                      [self.to], html_message=self.body_html, fail_silently=False)
            self.statut = self.STATUT_ENVOYE
        except Exception as exc:
            self.statut = self.STATUT_ECHEC
            self.erreur = str(exc)
        self.save()

    def expedier_async(self):
        envoyer_mail_async.delay(self.id)
