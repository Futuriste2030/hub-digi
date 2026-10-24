"""Attestation de formation — PDF A4 PAYSAGE, charte DIGI COM.

Maquette : colonne marine à gauche (logo, raison sociale, QR de traçabilité),
zone principale claire (titre, nom du stagiaire, texte, formation, faits,
signature avec sceau) et pied de page.

Le QR de traçabilité encode le lien public de vérification
`/attestation/<numero>?sig=…` (signé côté serveur) : il ne peut être ni deviné
ni forgé, et la page affiche l'attestation ENREGISTRÉE dans le HUB.

UNITÉS : toutes les coordonnées de mise en page sont en MILLIMÈTRES ; la
conversion en points se fait au moment de l'appel canvas (constante `mm`).
"""

import math
import os
import re
from io import BytesIO

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdfcanvas

# Charte (alignée sur la maquette HTML)
ENCRE = HexColor("#12233F")       # marine profond
SIGNAL = HexColor("#1597A8")      # teal
SCEAU = HexColor("#B0863A")       # or
BRUME = HexColor("#EDF1F6")       # gris clair
TEXTE = HexColor("#1E2736")
MUET = HexColor("#5B6678")
LIGNE = HexColor("#CBD3DF")

SANS = "Helvetica"
SANS_B = "Helvetica-Bold"
SERIF = "Times-Roman"
SERIF_B = "Times-Bold"
SERIF_I = "Times-Italic"

LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    "static", "logo-digi-com.png")

PAGE = landscape(A4)          # points : 841.89 x 595.28
LARGEUR_MM, HAUTEUR_MM = 297, 210
COLONNE_MM = 68              # largeur de la bande marine
MARGE_MM = 15                # marge de la zone principale


def _txt(val):
    """Texte pour le CANVAS (ReportLab n'interprète pas le HTML)."""
    txt = re.sub(r"<[^>]*>", " ", str(val if val is not None else ""))
    return re.sub(r"\s+", " ", txt).strip() or "—"


def _couper(texte, police, taille, largeur_max_mm):
    """Découpe un texte long en lignes qui tiennent dans largeur_max_mm."""
    largeur_max = largeur_max_mm * mm
    mots = re.split(r"(\s+)", texte)
    lignes, courante = [], ""
    for mot in mots:
        essai = courante + mot
        if stringWidth(essai, police, taille) <= largeur_max or not courante:
            courante = essai
        else:
            lignes.append(courante)
            courante = mot
    if courante:
        lignes.append(courante)
    return lignes


def _date_fr(val, long=False):
    try:
        return val.strftime("%d %B %Y" if long else "%d/%m/%Y")
    except Exception:
        return str(val or "—")


def _mois_fr(val):
    mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
            "août", "septembre", "octobre", "novembre", "décembre"]
    try:
        return f"{val.day} {mois[val.month - 1]} {val.year}"
    except Exception:
        return str(val or "—")


# ------------------------------------------------------------------ colonne --
def _colonne_gauche(c, soc, lien, code):
    """Bande marine : logo, raison sociale, QR de traçabilité."""
    c.setFillColor(ENCRE)
    c.rect(0, 0, COLONNE_MM * mm, HAUTEUR_MM * mm, stroke=0, fill=1)
    c.setFillColor(SIGNAL)
    c.rect(0, (HAUTEUR_MM - 3) * mm, COLONNE_MM * mm, 3 * mm, stroke=0, fill=1)

    # Logo dans un carré blanc arrondi (le PNG est sur fond blanc), avec une
    # marge pour ne pas être collé au bord du document.
    _logo_blanc(c, 12, HAUTEUR_MM - 44, 22)
    c.setFillColor(white)
    c.setFont(SANS_B, 11)
    y = HAUTEUR_MM - 51
    for ligne in _couper(soc["raison"].upper(), SANS_B, 11, COLONNE_MM - 24)[:3]:
        c.drawString(12 * mm, y * mm, ligne)
        y -= 6.5
    c.setFillColor(HexColor("#9FB0C4"))
    c.setFont(SANS, 7.6)
    y -= 1.5
    for ligne in _couper(soc.get("tagline", "Communication, marketing et solutions numeriques"),
                         SANS, 7.6, COLONNE_MM - 24)[:3]:
        c.drawString(12 * mm, y * mm, ligne)
        y -= 4.8

    # QR de traçabilité + code court + mention.
    c.setFillColor(HexColor("#9FB0C4"))
    c.setFont(SANS_B, 7.4)
    c.drawString(12 * mm, 56 * mm, "AUTHENTICITE DU DOCUMENT")
    c.setFillColor(white)
    c.setFont(SANS_B, 9)
    c.drawString(12 * mm, 51 * mm, _txt(code))
    qr = _qr_image(lien)
    if qr is not None:
        c.setFillColor(white)
        c.rect(12 * mm, 19 * mm, 26 * mm, 26 * mm, stroke=0, fill=1)
        c.drawImage(ImageReader(qr), 13 * mm, 20 * mm, width=24 * mm, height=24 * mm,
                    preserveAspectRatio=True, mask="auto")
    # Mention sous le QR : c'est le QR qui authentifie le document.
    c.setFillColor(HexColor("#C6D2E0"))
    c.setFont(SANS, 6.6)
    c.drawString(12 * mm, 15 * mm, "Scannez ce QR code pour")
    c.drawString(12 * mm, 11 * mm, "authentifier l'attestation.")


def _logo_blanc(c, x_mm, y_mm, taille_mm):
    """Logo DIGI COM dans un carré blanc arrondi (image containée)."""
    c.setFillColor(white)
    c.roundRect(x_mm * mm, y_mm * mm, taille_mm * mm, taille_mm * mm, 3 * mm,
                stroke=0, fill=1)
    try:
        from PIL import Image as PILImage

        with PILImage.open(LOGO) as pil:
            larg, haut = pil.size
        # Contain : le logo peut être très large — il doit tenir DANS le carré.
        dispo = taille_mm * 0.8
        facteur = min(dispo / larg, dispo / haut)
        largeur, hauteur = larg * facteur, haut * facteur
        c.drawImage(ImageReader(LOGO),
                    (x_mm + (taille_mm - largeur) / 2) * mm,
                    (y_mm + (taille_mm - hauteur) / 2) * mm,
                    width=largeur * mm, height=hauteur * mm,
                    preserveAspectRatio=True, mask="auto")
    except Exception:
        pass


def _qr_image(valeur):
    """QR code (traçabilité) en buffer PNG, ou None."""
    try:
        import qrcode

        img = qrcode.make(valeur, box_size=8, border=2)
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf
    except Exception:
        return None


# ------------------------------------------------------------------- sceau --
def _sceau(c, centre_x_mm, centre_y_mm, rayon_mm, societe, ville):
    """Sceau doré (2 cercles + texte sur arc + monogramme)."""
    c.setStrokeColor(SCEAU)
    c.setFillColor(SCEAU)
    c.setLineWidth(1.1)
    c.circle(centre_x_mm * mm, centre_y_mm * mm, rayon_mm * mm, stroke=1, fill=0)
    c.setLineWidth(0.5)
    c.circle(centre_x_mm * mm, centre_y_mm * mm, rayon_mm * 0.62 * mm, stroke=1, fill=0)

    # Texte sur l'arc supérieur.
    texte = f"{societe.upper()} · {ville.upper()} · MALI · "
    taille = 4.6
    c.setFont(SANS_B, taille)
    largeur_totale = sum(stringWidth(ch, SANS_B, taille) for ch in texte)
    rayon_texte = rayon_mm * 0.82
    angle = 180 - (largeur_totale / 2) / (rayon_texte * mm) * (180 / math.pi)
    for ch in texte:
        c.saveState()
        c.translate(centre_x_mm * mm, centre_y_mm * mm)
        c.rotate(angle)
        c.setFillColor(SCEAU)
        c.setFont(SANS_B, taille)
        c.drawString(0, rayon_texte * mm, ch)
        c.restoreState()
        angle += (stringWidth(ch, SANS_B, taille) / (rayon_texte * mm)) * (180 / math.pi)

    # Monogramme.
    c.setFillColor(SCEAU)
    c.setFont(SANS_B, 11)
    c.drawCentredString(centre_x_mm * mm, (centre_y_mm - 3) * mm, "DC")


def _cachet(c, x_mm, y_mm, taille_mm):
    """Cachet importé (SiteSettings.cachet_formation) — prioritaire sur le sceau dessiné."""
    tampon = _tampon_formation()
    if tampon is None:
        return False
    largeur = taille_mm * tampon.width / tampon.height
    c.drawImage(ImageReader(tampon), x_mm * mm, y_mm * mm,
                width=largeur * mm, height=taille_mm * mm,
                preserveAspectRatio=True, mask="auto")
    return True


def _tampon_formation(taille_px=600):
    """Cachet + signature superposés (comme les factures/contrats)."""
    try:
        from PIL import Image as PILImage

        from apps.core.models import SiteSettings

        inst = SiteSettings.instance()
        cachet = getattr(inst, "cachet_formation", None)
        signature = getattr(inst, "signature_formation", None)
        if not cachet or not getattr(cachet, "path", None):
            return None
        base = PILImage.open(cachet.path).convert("RGBA")
        base.thumbnail((taille_px, taille_px), PILImage.LANCZOS)
        if signature and getattr(signature, "path", None):
            try:
                sign = PILImage.open(signature.path).convert("RGBA")
                larg = int(base.width * 0.62)
                sign = sign.resize((larg, int(sign.height * larg / sign.width)), PILImage.LANCZOS)
                sign = sign.rotate(-8, expand=True, resample=PILImage.BICUBIC)
                base.alpha_composite(sign, (int((base.width - sign.width) / 2),
                                            int((base.height - sign.height) / 2)))
            except Exception:
                pass
        return base
    except Exception:
        return None


# --------------------------------------------------------------- document ---
def _motif_fond(c):
    """Motif de fond discret (pixels) — rappel du domaine digital, très pâle.

    Le même esprit que le « dg-motif-pixels » du front : une trame de petits
    carrés. Teinte très pâle (pas d'alpha : le rendu PDF doit rester identique
    partout) pour ne jamais gêner la lecture du document.
    """
    try:
        c.saveState()
        c.setFillColor(HexColor("#E6F2F4"))
        pas = 11
        for i, x in enumerate(range(COLONNE_MM + 8, int(LARGEUR_MM) - 4, pas)):
            for j, y in enumerate(range(10, int(HAUTEUR_MM) - 8, pas)):
                if (i + j) % 4:
                    continue
                taille = 2.6 if (i + j) % 8 == 0 else 1.4
                c.rect(x * mm, y * mm, taille * mm, taille * mm, stroke=0, fill=1)
        c.restoreState()
    except Exception:
        pass


def pdf_attestation(attestation, libelle="Attestation de formation"):
    """Génère le PDF de l'attestation. Retourne un BytesIO."""
    from apps.formations.liens import lien_verification_attestation

    inscription = attestation.inscription
    formation = inscription.formation
    participant = inscription.participant

    soc = _societe()
    lien = lien_verification_attestation(attestation.numero)
    x = COLONNE_MM + MARGE_MM          # début de la zone principale
    largeur_texte = LARGEUR_MM - x - 16

    buf = BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=PAGE)
    c.setTitle(f"Attestation de formation - {participant.full_name}")
    c.setAuthor(soc["raison"])

    _colonne_gauche(c, soc, lien, attestation.numero)
    _motif_fond(c)

    # --- Bandeau haut : référence + lieu/date
    c.setFillColor(ENCRE)
    c.setFont(SANS_B, 9)
    c.drawString(x * mm, 192 * mm, f"N° {_txt(attestation.numero)}")
    c.setFillColor(MUET)
    c.setFont(SANS, 9)
    c.drawRightString((LARGEUR_MM - 16) * mm, 192 * mm,
                      f"{soc.get('ville') or 'Bamako'}, le {_mois_fr(attestation.date_delivrance)}")

    # --- Titre + filet teal
    c.setFillColor(ENCRE)
    c.setFont(SANS_B, 26)
    c.drawString(x * mm, 172 * mm, libelle)
    c.setFillColor(SIGNAL)
    c.rect(x * mm, 166 * mm, 24 * mm, 1.6 * mm, stroke=0, fill=1)

    # --- Phrase d'introduction (serif italique) + nom (serif gras)
    c.setFillColor(MUET)
    c.setFont(SERIF_I, 12)
    c.drawString(x * mm, 150 * mm, f"{soc['raison'].upper()} atteste que")
    c.setFillColor(ENCRE)
    c.setFont(SERIF_B, 22)
    c.drawString(x * mm, 136 * mm, _txt(participant.full_name))
    if participant.email:
        c.setFillColor(MUET)
        c.setFont(SANS, 8)
        c.drawString(x * mm, 130 * mm, _txt(participant.email))

    # --- Texte principal
    c.setFillColor(TEXTE)
    c.setFont(SANS, 11)
    debut = _date_fr(formation.date_debut, long=True)
    fin = _date_fr(formation.date_fin, long=True)
    if formation.date_debut:
        phrase = (f"a suivi avec assiduité la formation dispensée par {soc['raison']} "
                  f"du {debut}" + (f" au {fin}" if formation.date_fin else "") + ", intitulée :")
    else:
        phrase = f"a suivi avec assiduité la formation dispensée par {soc['raison']}, intitulée :"
    y = 118
    for ligne in _couper(phrase, SANS, 11, largeur_texte):
        c.drawString(x * mm, y * mm, ligne)
        y -= 7

    # --- Titre de la formation (barre teal à gauche)
    y -= 3
    c.setFillColor(SIGNAL)
    c.rect(x * mm, (y - 5) * mm, 1.6 * mm, 9 * mm, stroke=0, fill=1)
    c.setFillColor(ENCRE)
    c.setFont(SANS_B, 14)
    lignes_formation = _couper(formation.titre, SANS_B, 14, largeur_texte - 4)[:2]
    for j, ligne in enumerate(lignes_formation):
        c.drawString((x + 4) * mm, (y - j * 6.5) * mm, ligne)
    y -= (len(lignes_formation) - 1) * 6.5 + 8

    # --- Faits : durée / lieu / début / fin (l'appréciation est une ligne à part)
    faits = []
    if formation.duree:
        faits.append(("Durée", formation.duree))
    if formation.lieu:
        faits.append(("Lieu", formation.lieu))
    if formation.date_debut:
        faits.append(("Début", _date_fr(formation.date_debut)))
    if formation.date_fin:
        faits.append(("Fin", _date_fr(formation.date_fin)))
    if formation.departement:
        faits.append(("Département", formation.departement))
    y -= 4
    if faits:
        c.setStrokeColor(LIGNE)
        c.setLineWidth(0.4)
        larg_fait = min(46, (largeur_texte - 6) / len(faits))
        # Hauteur réelle = celle de la valeur la plus longue (2 lignes max).
        lignes_par_fait = [_couper(_txt(valeur), SANS_B, 9.5, larg_fait - 5)[:2]
                          for _, valeur in faits]
        for i, ((libelle, _), lignes_valeur) in enumerate(zip(faits, lignes_par_fait)):
            fx = x + i * larg_fait
            if i:
                c.line((fx - 3) * mm, (y - 4) * mm, (fx - 3) * mm, (y + 4) * mm)
            c.setFillColor(MUET)
            c.setFont(SANS_B, 7.4)
            c.drawString(fx * mm, (y + 2.4) * mm, libelle.upper())
            c.setFillColor(ENCRE)
            c.setFont(SANS_B, 9.5)
            for j, ligne in enumerate(lignes_valeur):
                c.drawString(fx * mm, (y - 3 - j * 4.4) * mm, ligne)
        y -= 5 + (max(len(l) for l in lignes_par_fait) - 1) * 4.4 + 9

    # --- Appréciation (mention) : ligne dédiée, italique
    if attestation.mention:
        c.setFillColor(MUET)
        c.setFont(SERIF_I, 10.5)
        c.drawString(x * mm, y * mm, "Appréciation :")
        c.setFillColor(ENCRE)
        c.setFont(SERIF_I, 10.5)
        for ligne in _couper(_txt(attestation.mention), SERIF_I, 10.5, largeur_texte - 26)[:2]:
            c.drawString((x + 26) * mm, y * mm, ligne)
            y -= 5
        y -= 4

    # --- Signature
    c.setFillColor(MUET)
    c.setFont(SANS, 9)
    c.drawString(x * mm, 46 * mm, "La présente attestation est délivrée à l'intéressé(e) pour")
    c.drawString(x * mm, 41 * mm, "servir et valoir ce que de droit.")

    sx = LARGEUR_MM - 16 - 62
    c.setFillColor(TEXTE)
    c.setFont(SANS, 9.5)
    c.drawString(sx * mm, 46 * mm, f"Fait à {soc.get('ville') or 'Bamako'}, le {_date_fr(attestation.date_delivrance)}")
    c.setFillColor(ENCRE)
    c.setFont(SANS_B, 8)
    c.drawString(sx * mm, 41 * mm, _txt(soc.get("fonction_formation") or "Chef Département Ingénierie Informatique"))
    # Espace signature + sceau (le sceau passe sous la fonction du signataire).
    if not _cachet(c, sx + 2, 17, 25):
        _sceau(c, sx + 15, 29, 12, soc["raison"], soc.get("ville") or "Bamako")
    c.setStrokeColor(ENCRE)
    c.setLineWidth(0.4)
    c.line(sx * mm, 18 * mm, (sx + 62) * mm, 18 * mm)
    c.setFillColor(ENCRE)
    c.setFont(SANS_B, 10)
    c.drawString(sx * mm, 13 * mm, _txt(soc.get("signataire_formation") or "La Direction des Formations"))

    # --- Pied de page : informations issues des settings (SiteSettings)
    c.setStrokeColor(LIGNE)
    c.setLineWidth(0.4)
    c.line(x * mm, 8 * mm, (LARGEUR_MM - 16) * mm, 8 * mm)
    c.setFillColor(MUET)
    c.setFont(SANS, 7)
    gauche = f"{soc['raison']} · {soc.get('adresse') or ''}"
    # Le pied saisi dans /parametres s'ajoute à gauche s'il tient.
    if soc.get("pied"):
        essai = f"{gauche} · {soc['pied']}"
        if stringWidth(essai, SANS, 7) < (LARGEUR_MM - 16 - x - 40) * mm:
            gauche = essai
    c.drawString(x * mm, 4 * mm, gauche)
    legal = " · ".join(v for v in [f"Tel. {soc.get('phone')}" if soc.get("phone") else "",
                                   f"RCCM {soc.get('rccm')}" if soc.get("rccm") else "",
                                   f"NIF {soc.get('nif')}" if soc.get("nif") else ""] if v)
    c.drawRightString((LARGEUR_MM - 16) * mm, 4 * mm, legal)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf


def _societe():
    """Données société (SiteSettings) + repli."""
    try:
        from apps.core.models import SiteSettings

        s = SiteSettings.instance()
        return {
            "raison": s.raison, "nif": s.nif, "rccm": s.rccm, "adresse": s.adresse,
            "phone": s.phone, "email": s.email,
            "tagline": "Communication, marketing et solutions numeriques",
            "signataire": s.signataire,
            "signataire_formation": getattr(s, "signataire_formation", "") or s.signataire,
            "fonction_formation": getattr(s, "fonction_formation", "") or "",
            "pied": getattr(s, "pied", "") or "",
            "ville": "Bamako",
        }
    except Exception:
        return {
            "raison": "DIGI COM & TECHNOLOGIES", "nif": "081234567A",
            "rccm": "ML-BKO-2021-B-1234", "adresse": "Sotuba ACI-2000, Bamako",
            "phone": "(+223) 70 16 33 86", "email": "contact@digicom.ml",
            "tagline": "Communication, marketing et solutions numeriques",
            "signataire": "La Direction", "signataire_formation": "La Direction des Formations",
            "fonction_formation": "Chef Département Ingénierie Informatique",
            "pied": "", "ville": "Bamako",
        }
