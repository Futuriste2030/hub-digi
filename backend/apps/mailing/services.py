"""Envoi via template nommé — rend {{ variables }}, enveloppe charte, trace, expédie en async."""

from .layout import ACCENT_DEFAUT, ACCENTS, mise_en_page
from .models import EmailIdentity, MailTemplate, SentMail


def send_templated_mail(template_key, to, contexte=None, identity=None, department_slug=None,
                        client=None, ticket=None, project=None, attachment=None):
    """Retourne le SentMail (ou None si template inactif/absent ou destinataire vide).

    `attachment` : pièce jointe optionnelle, soit des octets bruts, soit un tuple
    (nom_fichier, octets) ou (nom_fichier, octets, mimetype)."""
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

    nom_pj = ""
    type_pj = "application/pdf"
    contenu_pj = None
    if attachment is not None:
        if isinstance(attachment, (tuple, list)):
            if len(attachment) >= 2:
                nom_pj = str(attachment[0] or "")
                contenu_pj = attachment[1]
            if len(attachment) >= 3 and attachment[2]:
                type_pj = str(attachment[2])
        elif isinstance(attachment, dict):
            nom_pj = str(attachment.get("nom") or attachment.get("filename") or "")
            contenu_pj = attachment.get("contenu") or attachment.get("content") or attachment.get("bytes")
            if attachment.get("type") or attachment.get("mimetype"):
                type_pj = str(attachment.get("type") or attachment.get("mimetype"))
        else:
            contenu_pj = attachment
        if contenu_pj is not None and not isinstance(contenu_pj, (bytes, bytearray)):
            try:
                contenu_pj = bytes(contenu_pj)
            except Exception:
                contenu_pj = None
        if contenu_pj is not None and not nom_pj:
            nom_pj = "piece-jointe.pdf"

    mail = SentMail.objects.create(
        identity=identity, to=to, subject=subject, body_html=body,
        client=client, ticket=ticket, project=project,
        piece_jointe_nom=nom_pj, piece_jointe_type=type_pj,
        piece_jointe=bytes(contenu_pj) if contenu_pj is not None else None,
    )
    mail.expedier_async()  # Celery (eager en dev = synchrone)
    mail.refresh_from_db()
    return mail
