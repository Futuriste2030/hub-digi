"""PDF contrat au design de l'aperçu frontend (EspaceRedaction/ContratEmploye) :
papier à en-tête, catégorie, titre centré, sous-titre, contenu rédigé, double
signature (Salarié / Employeur + tampon juridique), pied officiel."""

import os
import re
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

MARINE = HexColor("#0b182b")
GRIS_TITRE = HexColor("#32425b")
NOIR = HexColor("#0b182b")
LIGNE = HexColor("#d6dce3")

STATIC = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                      "static")
ENTETE_HAUT = os.path.join(STATIC, "entete-haut.png")
ENTETE_BAS = os.path.join(STATIC, "entete-bas.png")


def propre(val):
    txt = re.sub(r"<[^>]*>", " ", str(val if val is not None else ""))
    txt = escape(txt)
    return re.sub(r"\s+", " ", txt).strip() or "—"


def _pleine_largeur(path):
    try:
        from PIL import Image as PILImage

        with PILImage.open(path) as pil:
            larg, haut = pil.size
        largeur = 182 * mm
        return Image(path, width=largeur, height=largeur * haut / larg)
    except Exception:
        return None


def _tampon_juridique(taille_mm=32):
    try:
        from PIL import Image as PILImage

        from apps.core.models import SiteSettings

        inst = SiteSettings.instance()
        cachet = getattr(inst, "cachet_juridique", None)
        signature = getattr(inst, "signature_juridique", None)
        if not cachet or not getattr(cachet, "path", None):
            return None
        base = PILImage.open(cachet.path).convert("RGBA")
        base.thumbnail((520, 520), PILImage.LANCZOS)
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
        buf = BytesIO()
        base.save(buf, format="PNG")
        buf.seek(0)
        hauteur = taille_mm * mm
        img = Image(buf, width=hauteur * base.width / base.height, height=hauteur)
        img.hAlign = "CENTER"
        return img
    except Exception:
        return None


def pdf_contrat(contrat):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=12 * mm, bottomMargin=14 * mm,
                            leftMargin=14 * mm, rightMargin=14 * mm)
    base = getSampleStyleSheet()
    normal = ParagraphStyle("doc", parent=base["Normal"], fontName="Helvetica", fontSize=11,
                            leading=17, textColor=NOIR)
    centre = ParagraphStyle("centre", parent=normal, alignment=1)
    surtitre = ParagraphStyle("surtitre", parent=normal, fontName="Helvetica-Bold", fontSize=9,
                              leading=12, textColor=GRIS_TITRE, alignment=1)
    titre = ParagraphStyle("titre", parent=normal, fontName="Helvetica-Bold", fontSize=17,
                           leading=21, alignment=1)
    sous_titre = ParagraphStyle("sous_titre", parent=normal, fontSize=10, leading=13,
                                textColor=GRIS_TITRE, alignment=1)
    intertitre = ParagraphStyle("intertitre", parent=normal, fontName="Helvetica-Bold",
                                fontSize=13, leading=16, textColor=NOIR)
    citation = ParagraphStyle("citation", parent=normal, leftIndent=12, textColor=GRIS_TITRE,
                              fontName="Helvetica-Oblique")
    story = []

    haut = _pleine_largeur(ENTETE_HAUT)
    if haut is not None:
        story += [haut, Spacer(1, 5 * mm)]

    categorie = {"client": "Contrat client", "fournisseur": "Contrat fournisseur",
                 "employe": "Contrat de travail"}.get(contrat.type, "Contrat")
    story.append(Paragraph(propre(categorie).upper(), surtitre))
    story.append(Paragraph(propre(contrat.titre), titre))
    if contrat.type == "employe" and contrat.employe_id:
        sous = f"{contrat.employe.user.email} — {contrat.employe.fonction or ''}"
    elif contrat.client_id:
        sous = contrat.client.nom_societe
    else:
        sous = ""
    if sous.strip(" —"):
        story.append(Paragraph(propre(sous), sous_titre))
    story.append(Spacer(1, 5 * mm))

    blocs = re.findall(r"<(h[123]|blockquote|li|p)[^>]*>(.*?)</\1>",
                       str(contrat.contenu or ""), re.DOTALL | re.IGNORECASE)
    if not blocs:
        blocs = [("p", str(contrat.contenu or ""))]
    for balise, contenu in blocs:
        texte = propre(contenu)
        if texte == "—":
            continue
        balise = balise.lower()
        if balise in ("h1", "h2", "h3"):
            story.append(Paragraph(f"<b>{texte}</b>", intertitre))
        elif balise == "blockquote":
            story.append(Paragraph(f"<i>{texte}</i>", citation))
        elif balise == "li":
            story.append(Paragraph(f"• {texte}", normal))
        else:
            story.append(Paragraph(texte, normal))
        story.append(Spacer(1, 2 * mm))

    story.append(Spacer(1, 5 * mm))
    tampon = _tampon_juridique()
    droit = [tampon, Paragraph("L Employeur", normal)] if tampon is not None else []
    signatures = Table([[
        Paragraph("<b>Le Salarié</b><br/>Lu et approuvé", centre),
        Paragraph("<b>L Employeur</b><br/>Signature et cachet", centre) if tampon is None else droit,
    ]], colWidths=[91 * mm, 91 * mm])
    signatures.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (0, 0), 0.6, GRIS_TITRE),
        ("LINEABOVE", (1, 0), (1, 0), 0.6, GRIS_TITRE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(signatures)

    bas = _pleine_largeur(ENTETE_BAS)
    if bas is not None:
        story += [Spacer(1, 6 * mm), bas]

    try:
        from apps.core.models import SiteSettings

        signataire = SiteSettings.instance().signataire
    except Exception:
        signataire = "La Direction"
    story += [Spacer(1, 3 * mm), Paragraph(propre(signataire), sous_titre)]

    doc.build(story)
    buf.seek(0)
    return buf
