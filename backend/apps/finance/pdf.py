"""PDF serveur, copie du design frontend (FactureDoc / DevisDoc / RecuDoc) :
bandeau marine (logo + société + NIF/RCCM en blanc, type + numéro à droite),
ligne méta, blocs Émetteur / client sur fond gris, tableau HT-TVA-TTC, totaux,
conditions, signature, pied de page.

Règles anti-défauts constatés :
- tout texte dynamique est nettoyé (balises HTML supprimées) puis échappé :
  aucune balise ne peut apparaître dans le PDF ;
- les paragraphes du bandeau portent leur couleur en ligne (blanc) : pas de
  texte noir sur fond bleu ;
- aucune table imbriquée dans le bandeau : pas de chevauchement.
ReportLab uniquement (pas de QR/barcode)."""

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
SIGNAL = HexColor("#4fa3dc")
GRIS_FOND = HexColor("#f4f6f8")
GRIS_TITRE = HexColor("#32425b")
BRUME = HexColor("#a9cfeb")
BLANC = HexColor("#ffffff")
NOIR = HexColor("#0b182b")
SUCCES = HexColor("#12855a")
LIGNE = HexColor("#d6dce3")

TAUX_TVA = 0
TAUX_TVA_ACTIVE = 18
CONDITIONS = "Paiement à 30 jours date de facture. Passé ce délai, pénalités de 1,5 % par mois de retard."
PIED = "Digi Com & Technologies — Merci de votre confiance."
LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    "static", "logo-digi-com.png")


def propre(val):
    """Texte brut sûr : balises HTML supprimées, entités échappées, espaces tassés."""
    txt = re.sub(r"<[^>]*>", " ", str(val if val is not None else ""))
    txt = escape(txt)
    return re.sub(r"\s+", " ", txt).strip() or "—"


def _montant(x):
    return f"{float(x or 0):,.0f}".replace(",", " ") + " F"


def _qr_image(valeur, taille_mm=28):
    """QR code (suivi/vérification, comme le frontend) ou None."""
    try:
        import qrcode

        img = qrcode.make(valeur, box_size=8, border=1)
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        qr = Image(buf, width=taille_mm * mm, height=taille_mm * mm)
        qr.hAlign = "LEFT"
        return qr
    except Exception:
        return None


def _tampon_image(prefixe="finance", taille_mm=32):
    """Tampon composite : signature superposée au cachet (comme le design).
    None si aucun cachet importé (le texte de signature reste utilisé)."""
    try:
        from PIL import Image as PILImage

        from apps.core.models import SiteSettings

        inst = SiteSettings.instance()
        cachet = getattr(inst, f"cachet_{prefixe}", None)
        signature = getattr(inst, f"signature_{prefixe}", None)
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


def _qr_bloc(normal, qr, titre, legende):
    if qr is None:
        return None
    return Table([
        [qr],
        [Paragraph(f"<font size=8><b>{propre(titre)}</b></font>", normal)],
        [Paragraph(f"<font size=7>{propre(legende)}</font>", normal)],
    ], colWidths=[100 * mm])


def _societe():
    try:
        from apps.core.models import SiteSettings

        s = SiteSettings.instance()
        return {
            "raison": s.raison, "nif": s.nif, "rccm": s.rccm, "adresse": s.adresse,
            "phone": s.phone, "email": s.email, "delai": s.delai_paiement,
            "signataire": s.signataire,
        }
    except Exception:
        return {
            "raison": "Digi Com & Technologies", "nif": "081234567A",
            "rccm": "ML-BKO-2021-B-1234", "adresse": "Sotuba ACI-2000, Bamako",
            "phone": "(+223) 70 16 33 86", "email": "contact@digicom.ml",
            "delai": "30 jours", "signataire": "La Direction Financière",
        }


def _styles():
    base = getSampleStyleSheet()
    normal = ParagraphStyle("doc", parent=base["Normal"], fontName="Helvetica", fontSize=9,
                            leading=12.5, textColor=NOIR)
    blanc = ParagraphStyle("blanc", parent=normal, textColor=BLANC)
    blanc_titre = ParagraphStyle("blanc_titre", parent=blanc, fontName="Helvetica-Bold",
                                 fontSize=11, leading=14)
    blanc_num = ParagraphStyle("blanc_num", parent=blanc, fontName="Helvetica-Bold",
                               fontSize=11, leading=14, alignment=2)
    surtitre = ParagraphStyle("surtitre", parent=blanc, fontName="Helvetica-Bold", fontSize=8,
                              leading=11, textColor=SIGNAL, alignment=2)
    sous_titre = ParagraphStyle("sous_titre", parent=blanc, fontSize=8, leading=10,
                                textColor=BRUME)
    gras = ParagraphStyle("gras", parent=normal, fontName="Helvetica-Bold")
    droite = ParagraphStyle("droite", parent=normal, alignment=2)
    droite_gras = ParagraphStyle("droite_gras", parent=gras, alignment=2)
    return normal, blanc, blanc_titre, blanc_num, surtitre, sous_titre, gras, droite, droite_gras


def _logo():
    """Logo calibré par hauteur (12 mm), proportions d'origine conservées."""
    try:
        from PIL import Image as PILImage

        with PILImage.open(LOGO) as pil:
            larg, haut = pil.size
        hauteur = 12 * mm
        img = Image(LOGO, width=hauteur * larg / haut, height=hauteur)
        img.hAlign = "LEFT"
        return img
    except Exception:
        return Paragraph("", _styles()[0])


def _base(titre_doc, numero):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=12 * mm, bottomMargin=14 * mm,
                            leftMargin=14 * mm, rightMargin=14 * mm)
    normal, blanc, blanc_titre, blanc_num, surtitre, sous_titre, gras, droite, droite_gras = _styles()
    soc = _societe()

    droite_doc = (
        f"<font color='#4fa3dc' size=8><b>{propre(titre_doc).upper()}</b></font>"
        f"<br/><font color='#ffffff' size=11><b>{propre(numero)}</b></font>")
    bandeau = Table([
        [_logo(), Paragraph(droite_doc, blanc_num)],
        [Paragraph(f"<b>{propre(soc['raison'])}</b>", blanc_titre),
         Paragraph("", blanc)],
        [Paragraph(f"NIF {propre(soc['nif'])} · RCCM {propre(soc['rccm'])}", sous_titre),
         Paragraph("", blanc)],
    ], colWidths=[110 * mm, 72 * mm])
    bandeau.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MARINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("SPAN", (1, 0), (1, 2)),
        ("VALIGN", (1, 0), (1, 2), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return doc, [bandeau, Spacer(1, 5 * mm)], buf, normal, soc, gras, droite, droite_gras


def _bloc(normal, titre, lignes):
    corps = "<br/>".join([l for l in lignes if l and l != "—"])
    txt = f"<font size=8 color='#32425b'><b>{propre(titre).upper()}</b></font>"
    if corps:
        txt += "<br/>" + corps
    return Paragraph(txt, normal)


def _blocs(normal, gauche_titre, gauche_lignes, droite_titre, droite_lignes):
    t = Table([[_bloc(normal, gauche_titre, gauche_lignes),
                _bloc(normal, droite_titre, droite_lignes)]],
              colWidths=[91 * mm, 91 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRIS_FOND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


def _gras(val):
    return f"<b>{propre(val)}</b>"


def _table_lignes(st, lignes, taux=0):
    normal, gras, droite, droite_gras = st["normal"], st["gras"], st["droite"], st["droite_gras"]
    data = [[Paragraph("Description", gras), Paragraph("Qté", gras), Paragraph("PU HT", droite_gras),
             Paragraph("Total HT", droite_gras)]]
    for l in lignes:
        q, m = float(l.quantite or 0), float(l.montant or 0)
        pu_ht = round(m * 100 / (100 + taux))
        data.append([Paragraph(propre(l.description), normal), Paragraph(f"{q:g}", normal),
                     Paragraph(_montant(pu_ht), droite), Paragraph(_montant(pu_ht * q), droite_gras)])
    t = Table(data, colWidths=[82 * mm, 20 * mm, 40 * mm, 40 * mm])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, MARINE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LIGNE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
    ]))
    return t


def _totaux(st, ttc, taux=0):
    normal, gras, droite, droite_gras = st["normal"], st["gras"], st["droite"], st["droite_gras"]
    ttc = float(ttc or 0)
    ht = round(ttc * 100 / (100 + taux))
    t = Table([
        [Paragraph("Total HT", normal), Paragraph(_montant(ht), droite)],
        [Paragraph(f"TVA {taux} %", normal), Paragraph(_montant(ttc - ht), droite)],
        [Paragraph("Total TTC", gras), Paragraph(_montant(ttc), droite_gras)],
    ], colWidths=[45 * mm, 45 * mm])
    t.setStyle(TableStyle([
        ("LINEABOVE", (0, 2), (-1, 2), 1.2, MARINE),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    cadre = Table([[t]], colWidths=[182 * mm])
    cadre.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "RIGHT")]))
    return cadre


def _pied(normal, soc, suivi=None):
    tampon = _tampon_image("finance")
    if tampon is not None:
        signature = Table([
            [tampon],
            [Paragraph(f"<font size=8>{propre(soc['signataire'])}</font>", normal)],
        ], colWidths=[82 * mm])
        signature.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    else:
        signature = Paragraph(f"{propre(soc['signataire'])}<br/>Signature et cachet", normal)
    if suivi is not None:
        bas = Table([[suivi, signature]], colWidths=[100 * mm, 82 * mm])
        bas.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        fin = [bas]
    else:
        fin = [signature]
    bandeau = Table([[
        Paragraph(
            f"<font size=8 color='#32425b'>{propre(soc['raison'])} — NIF {propre(soc['nif'])} — "
            f"RCCM {propre(soc['rccm'])} — {propre(PIED)}</font>", normal),
    ]], colWidths=[182 * mm])
    bandeau.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRIS_FOND),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return [
        Spacer(1, 4 * mm),
        Paragraph(propre(CONDITIONS), normal),
        Spacer(1, 4 * mm),
        *fin,
        Spacer(1, 4 * mm),
        bandeau,
    ]


def _date_fr(val):
    try:
        return val.strftime("%d/%m/%Y")
    except Exception:
        return str(val or "—")


def _emetteur(soc):
    return [_gras(soc["raison"]), propre(soc["adresse"]), propre(soc["phone"]), propre(soc["email"])]


def _client_lignes(client, extra=None):
    """Bloc destinataire : accepte un Client OU une Invoice (formations, client NULL)."""
    from apps.finance.models import Invoice as _Invoice

    if isinstance(client, _Invoice):
        lignes = [_gras(client.destinataire_nom), propre(client.destinataire_phone),
                  propre(client.destinataire_email)]
    else:
        lignes = [_gras(client.nom_societe), propre(client.adresse), propre(client.phone),
                  propre(client.email)]
    if extra:
        lignes.append(propre(extra))
    return lignes


def pdf_devis(devis):
    doc, story, buf, normal, soc, gras, droite, droite_gras = _base("Devis", devis.numero or "—")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    lignes = list(devis.lignes.all())
    ttc = sum(float(l.montant or 0) * float(l.quantite or 0) for l in lignes)
    story.append(Paragraph(
        f"Émis le <b>{_date_fr(devis.cree_le)}</b> · Valable jusqu'au "
        f"<b>{_date_fr(devis.validite)}</b> · Statut <b>{propre(devis.get_statut_display())}</b> · "
        "TVA <b>non applicable (0 %)</b>",
        normal))
    story.append(Spacer(1, 4 * mm))
    story.append(_blocs(normal, "Émetteur", _emetteur(soc), "Destinataire",
                        [_gras(devis.client.nom_societe), propre(devis.client.email),
                         propre(devis.objet)]))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, lignes, TAUX_TVA))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, ttc, TAUX_TVA))
    qr_valeur = f"https://app.digicom.ml/d/{devis.numero}?client={devis.client.nom_societe}&montant={ttc:g}"
    qr = _qr_image(qr_valeur)
    suivi = _qr_bloc(normal, qr, "Suivi du devis", qr_valeur)
    story += _pied(normal, soc, suivi=suivi)
    doc.build(story)
    buf.seek(0)
    return buf


def pdf_facture(facture):
    from django.conf import settings

    doc, story, buf, normal, soc, gras, droite, droite_gras = _base("Facture", facture.numero or "—")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    taux = TAUX_TVA_ACTIVE if facture.tva_active else TAUX_TVA
    lignes = list(facture.lignes.all())
    tva_txt = "TVA <b>18 % appliquée</b>" if facture.tva_active else "TVA <b>non applicable (0 %)</b>"
    story.append(Paragraph(
        f"Émise le <b>{_date_fr(facture.cree_le)}</b> · Paiement sous "
        f"<b>{propre(soc['delai'])}</b> · Statut <b>{propre(facture.get_statut_display())}</b> · {tva_txt}",
        normal))
    story.append(Spacer(1, 4 * mm))
    # Paiement en ligne : QR/lien pay.digicom.ml uniquement si PAYMENT_ENABLED=1.
    # Logique conservée, sortie neutralisée en attendant l'API (pas de lien mort).
    paiement_actif = getattr(settings, "PAYMENT_ENABLED", False)
    base_paiement = getattr(settings, "PAYMENT_URL", "https://pay.digicom.ml").rstrip("/")
    lien = f"{base_paiement}/f/{facture.numero}" if paiement_actif else ""
    story.append(_blocs(normal, "Émetteur", _emetteur(soc), "Facturé à",
                        _client_lignes(facture, lien or None)))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, lignes, taux))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, facture.total, taux))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Payé : <b>{_montant(facture.paye)}</b> — Solde : <b>{_montant(facture.solde)}</b>", normal))
    code = _qr_bloc(normal, _qr_image(lien), "Scannez pour payer", f"{facture.numero} — {lien}") if lien else None
    suivi = code
    story += _pied(normal, soc, suivi=suivi)
    doc.build(story)
    buf.seek(0)
    return buf


def pdf_recu(recu):
    from django.conf import settings

    doc, story, buf, normal, soc, gras, droite, droite_gras = _base("Reçu de paiement", recu.numero or "—")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    taux = TAUX_TVA_ACTIVE if recu.invoice.tva_active else TAUX_TVA
    story.append(Paragraph(
        f"Émis le <b>{_date_fr(recu.cree_le)}</b> · Facture <b>{propre(recu.invoice.numero)}</b> · "
        f"Moyen <b>{propre(recu.get_moyen_display())}</b>", normal))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        f"<font size=15 color='#12855a'><b>Montant reçu : {_montant(recu.montant)}</b></font>",
        normal))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Reçu de <b>{propre(recu.invoice.destinataire_nom)}</b> — règlement {propre(recu.invoice.numero)}",
        normal))
    story.append(Spacer(1, 4 * mm))
    story.append(_blocs(normal, "Émetteur", _emetteur(soc), "Reçu de",
                        _client_lignes(recu.invoice, f"Facture {recu.invoice.numero}")))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, recu.invoice.lignes.all(), taux))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, recu.invoice.total, taux))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Date de paiement : <b>{_date_fr(recu.cree_le)}</b> · "
        f"Moyen : <b>{propre(recu.get_moyen_display())}</b> · "
        f"Réf. transaction : <b>{propre(recu.ref_transaction or '—')}</b>", normal))
    # Sans gateway : QR de vérification interne (pas de domaine pay.digicom.ml mort).
    paiement_actif = getattr(settings, "PAYMENT_ENABLED", False)
    base_paiement = getattr(settings, "PAYMENT_URL", "https://pay.digicom.ml").rstrip("/")
    if paiement_actif:
        qr_valeur = f"{base_paiement}/r/{recu.numero}?facture={recu.invoice.numero}&montant={float(recu.montant or 0):g}"
        legende = f"{qr_valeur} — scannez pour vérifier l'authenticité du reçu."
    else:
        qr_valeur = f"HUB-DIGI:{recu.numero}:{recu.invoice.numero}:{float(recu.montant or 0):g}"
        legende = f"{qr_valeur} — référence interne (vérification en ligne bientôt disponible)."
    qr = _qr_image(qr_valeur)
    suivi = _qr_bloc(normal, qr, "Vérification", legende)
    story += _pied(normal, soc, suivi=suivi)
    doc.build(story)
    buf.seek(0)
    return buf
