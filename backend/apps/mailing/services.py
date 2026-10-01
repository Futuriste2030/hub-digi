"""Envoi via template nommé — rend {{ variables }}, enveloppe charte, trace, expédie en async."""

from .layout import ACCENT_DEFAUT, ACCENTS, mise_en_page
from .models import EmailIdentity, MailTemplate, SentMail


def send_templated_mail(template_key, to, contexte=None, identity=None, department_slug=None,
                        client=None, ticket=None, project=None):
    """Retourne le SentMail (ou None si template inactif/absent ou destinataire vide)."""
    if not to:
        return None
    try:
        template = MailTemplate.objects.get(key=template_key, actif=True)
    except MailTemplate.DoesNotExist:
        return None
    if identity is None and department_slug:
        identity = EmailIdentity.objects.filter(department__slug=department_slug).first()
    if identity is None:
        identity = EmailIdentity.objects.first()
    subject, body = template.rendre(contexte or {})
    body = mise_en_page(subject, body, ACCENTS.get(template_key, ACCENT_DEFAUT))
    mail = SentMail.objects.create(
        identity=identity, to=to, subject=subject, body_html=body,
        client=client, ticket=ticket, project=project,
    )
    mail.expedier_async()  # Celery (eager en dev = synchrone)
    mail.refresh_from_db()
    return mail
