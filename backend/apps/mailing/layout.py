"""Mise en page charte DIGI COM pour tous les mails transactionnels.

Règles e-mail : tableaux 600px, CSS inline uniquement (pas de JS, jamais exécuté
en boîte mail ; pas de fonts externes — Montserrat/Barlow avec fallback Arial).
Couleurs : tokens src/index.css (marine #0b182b, bleu digi #2f7cbe, signal #4fa3dc...).
"""

MARINE_PROFOND = "#0b182b"
MARINE_FOOTER = "#0a1526"
BLEU_DIGI = "#2f7cbe"
BLEU_SIGNAL = "#4fa3dc"
BLEU_BRUME = "#a9cfeb"
BLEU_TEXTE = "#276ba6"
GRIS_FOND = "#f4f6f8"
GRIS_TITRE = "#14233a"
GRIS_TEXTE = "#23334c"
BLANC = "#ffffff"

ACCENT_DEFAUT = BLEU_SIGNAL
ACCENTS = {
    "bienvenue_espace_client": BLEU_SIGNAL,
    "facture_disponible": BLEU_SIGNAL,
    "relance_facture": "#f0b458",  # alerte-lumineux
    "recu_disponible": "#4fc08d",  # succes-lumineux
    "reponse_ticket": "#6fb4e4",  # info-lumineux
    "validation_visuel": "#f0b458",
    "reset_password": BLEU_DIGI,
    "conge_rappel_j3": "#4fc08d",
    "reunion_convocation": BLEU_SIGNAL,
    "reunion_pv_diffusion": BLEU_SIGNAL,
}


def bouton(libelle, url):
    """Bouton compatible boîtes mail (tableau + bgcolor, styles inline)."""
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">'
        "<tr>"
        f'<td align="center" bgcolor="{BLEU_DIGI}" style="border-radius:4px;">'
        f'<a href="{url}" style="display:inline-block;padding:12px 28px;'
        "font-family:Arial,sans-serif;font-size:15px;font-weight:bold;"
        f'color:{BLANC};text-decoration:none;">{libelle}</a>'
        "</td></tr></table>"
    )


def mise_en_page(titre, corps, accent=ACCENT_DEFAUT):
    """Enveloppe le contenu (body_html du template) dans le layout charte."""
    return (
        '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<style>a{{color:{BLEU_TEXTE};}}</style></head>"
        f'<body style="margin:0;padding:0;background-color:{GRIS_FOND};">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background-color:{GRIS_FOND};padding:24px 12px;"><tr><td align="center">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" '
        'style="max-width:600px;width:100%;">'
        f'<tr><td style="background-color:{MARINE_PROFOND};padding:28px 32px;border-radius:8px 8px 0 0;">'
        '<p style="margin:0;font-family:Montserrat,Arial,sans-serif;font-size:20px;font-weight:800;'
        f'letter-spacing:2px;color:{BLANC};">HUB DIGI</p>'
        '<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:13px;'
        f'color:{BLEU_BRUME};">Digi Com &amp; Technologies</p></td></tr>'
        f'<tr><td style="background-color:{accent};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>'
        f'<tr><td style="background-color:{BLANC};padding:32px;'
        "font-family:Arial,sans-serif;font-size:15px;line-height:1.6;"
        f'color:{GRIS_TEXTE};">'
        '<h2 style="margin:0 0 16px;font-family:Montserrat,Arial,sans-serif;'
        f'font-size:18px;color:{GRIS_TITRE};">{titre}</h2>'
        f"{corps}</td></tr>"
        f'<tr><td style="background-color:{MARINE_FOOTER};padding:20px 32px;border-radius:0 0 8px 8px;">'
        '<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;'
        f'color:{BLEU_BRUME};">Digi Com &amp; Technologies — HUB DIGI · Bamako, Mali</p>'
        '<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;'
        f'color:{BLEU_BRUME};">Mail automatique, merci de ne pas y répondre directement.</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )
