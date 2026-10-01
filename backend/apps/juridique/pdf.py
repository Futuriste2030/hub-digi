"""PDF contrat au design de l'aperçu frontend (EspaceRedaction/ContratEmploye) :
papier à en-tête, catégorie, titre centré, sous-titre (cible · date · statut),
contenu rédigé, double signature (Salarié / Employeur + tampon juridique),
signature électronique du salarié si signée, pied officiel."""

import os
import re
from html.parser import HTMLParser
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


class _BlocsHtml(HTMLParser):
    """Découpe le HTML de l'éditeur riche en blocs typés (titres, paragraphes,
    listes numérotées ou non, citations) avec gras/italique inline.
    Toute balise inconnue est ignorée : aucune balise ne fuit dans le PDF."""

    def __init__(self):
        super().__init__()
        self.blocs = []  # (type, texte_reportlab)
        self._courant = None
        self._compteur_ol = []
        self._listes = []  # pile ul/ol pour typer les li même en série

    def _pousser(self, type_bloc):
        self._vider()
        self._courant = [type_bloc, ""]
        if type_bloc == "ol":
            self._compteur_ol.append(0)

    def _vider(self):
        if self._courant is not None:
            type_bloc, texte = self._courant
            texte = re.sub(r"\s+", " ", texte).strip()
            if texte:
                self.blocs.append((type_bloc, texte))
            self._courant = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._pousser("titre")
        elif tag in ("p", "div"):
            if self._courant is None or self._courant[0] not in ("paragraphe",):
                self._pousser("paragraphe")
        elif tag == "blockquote":
            self._pousser("citation")
        elif tag == "ul":
            self._listes.append("ul")
            self._pousser("ul")
        elif tag == "ol":
            self._listes.append("ol")
            self._pousser("ol")
        elif tag == "li":
            parent = self._listes[-1] if self._listes else "ul"
            self._pousser("li_ord" if parent == "ol" else "li")
            if parent == "ol" and self._compteur_ol:
                self._compteur_ol[-1] += 1
        elif tag == "br":
            if self._courant is not None:
                self._courant[1] += "<br/>"
        elif tag in ("strong", "b"):
            if self._courant is not None:
                self._courant[1] += "<b>"
        elif tag in ("em", "i"):
            if self._courant is not None:
                self._courant[1] += "<i>"
        elif tag in ("u", "a"):
            pass  # souligné/liens : texte seul, sans décoration PDF

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("strong", "b"):
            if self._courant is not None:
                self._courant[1] += "</b>"
        elif tag in ("em", "i"):
            if self._courant is not None:
                self._courant[1] += "</i>"
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "blockquote", "li"):
            self._vider()
        elif tag in ("ul", "ol"):
            self._vider()
            if tag == "ol" and self._compteur_ol:
                self._compteur_ol.pop()
            if self._listes and self._listes[-1] == tag:
                self._listes.pop()

    def handle_data(self, data):
        if self._courant is None:
            if data.strip():
                self._courant = ["paragraphe", ""]
            else:
                return
        self._courant[1] += escape(data)


def _blocs_contenu(html):
    parseur = _BlocsHtml()
    try:
        parseur.feed(str(html or ""))
        parseur.close()
    except Exception:
        pass
    parseur._vider()
    if not parseur.blocs:
        texte = propre(html)
        return [("paragraphe", texte)] if texte != "—" else []
    return parseur.blocs


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
    meta = " · ".join([m for m in [
        contrat.get_type_display() if hasattr(contrat, "get_type_display") else contrat.type,
        contrat.cree_le.strftime("%d/%m/%Y") if contrat.cree_le else "",
        str(contrat.statut or ""),
    ] if m])
    if meta.strip(" ·"):
        story.append(Paragraph(propre(meta), sous_titre))
    story.append(Spacer(1, 5 * mm))

    numero = 0
    for type_bloc, texte in _blocs_contenu(contrat.contenu):
        if type_bloc == "titre":
            story.append(Paragraph(f"<b>{texte}</b>", intertitre))
        elif type_bloc == "citation":
            story.append(Paragraph(f"<i>{texte}</i>", citation))
            numero = 0
        elif type_bloc == "li":
            story.append(Paragraph(f"• {texte}", normal))
            numero = 0
        elif type_bloc == "li_ord":
            numero += 1
            story.append(Paragraph(f"{numero}. {texte}", normal))
        else:
            story.append(Paragraph(texte, normal))
            numero = 0
        story.append(Spacer(1, 2 * mm))

    story.append(Spacer(1, 5 * mm))
    if getattr(contrat, "signature_employe_le", None):
        gauche = Paragraph(
            f"<b>Le Salarié</b><br/>Signé électroniquement par "
            f"{propre(contrat.signature_employe_nom)}<br/>le "
            f"{contrat.signature_employe_le.strftime('%d/%m/%Y à %H:%M')}<br/>"
            f"Réf. {propre(contrat.signature_employe_hash or '')}", centre)
    else:
        gauche = Paragraph("<b>Le Salarié</b><br/>Lu et approuvé (en attente de signature)", centre)
    tampon = _tampon_juridique()
    droit = [tampon, Paragraph("L Employeur", normal)] if tampon is not None else []
    signatures = Table([[
        gauche,
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
