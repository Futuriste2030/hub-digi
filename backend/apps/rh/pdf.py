"""PDF rapport mensuel de pointage — charte marine (bandeau + tableau + employé du mois)."""

from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

MARINE = HexColor("#0b182b")
SIGNAL = HexColor("#4fa3dc")
GRIS_FOND = HexColor("#f4f6f8")
BLANC = HexColor("#ffffff")
NOIR = HexColor("#0b182b")
SUCCES = HexColor("#12855a")
LIGNE = HexColor("#d6dce3")


def _f(montant):
    return f"{float(montant or 0):,.0f}".replace(",", " ") + " F"


def rapport_pointage_pdf(rapport):
    """Construit le PDF du rapport mensuel (dict de _rapport_mensuel + prime)."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm,
                            topMargin=12 * mm, bottomMargin=14 * mm)
    styles = getSampleStyleSheet()
    titre = ParagraphStyle("titre", parent=styles["Title"], textColor=BLANC, fontSize=16, leading=20)
    sous = ParagraphStyle("sous", parent=styles["Normal"], textColor=BLANC, fontSize=10, leading=14)
    corps = ParagraphStyle("corps", parent=styles["Normal"], textColor=NOIR, fontSize=10, leading=14)
    cellule = ParagraphStyle("cellule", parent=styles["Normal"], textColor=NOIR, fontSize=9, leading=12)

    elements = []
    bandeau = Table([
        [Paragraph("Digi Com &amp; Technologies", titre),
         Paragraph(f"Rapport de pointage — {rapport['mois']}", sous)],
    ], colWidths=[85 * mm, 85 * mm])
    bandeau.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MARINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    elements += [bandeau, Spacer(1, 6 * mm)]
    elements.append(Paragraph(
        f"Jours ouvrés : {rapport['jours_ouvres']} — Horaires 08h00–17h00 (retard après 08h15).", corps))
    elements.append(Spacer(1, 4 * mm))

    donnees = [["Employé", "Prés.", "Retards", "Dép. ant.", "Abs.", "Heures", "Score"]]
    for l in rapport["lignes"]:
        donnees.append([
            Paragraph(l["email"], cellule), str(l["presents"]), str(l["retards"]),
            str(l["departs_anticipes"]), str(l["absences"]), str(l["heures"]), str(l["score"]),
        ])
    tableau = Table(donnees, colWidths=[62 * mm, 16 * mm, 18 * mm, 18 * mm, 14 * mm, 18 * mm, 16 * mm],
                    repeatRows=1)
    style = [("BACKGROUND", (0, 0), (-1, 0), MARINE),
             ("TEXTCOLOR", (0, 0), (-1, 0), BLANC),
             ("GRID", (0, 0), (-1, -1), 0.5, LIGNE),
             ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BLANC, GRIS_FOND])]
    tableau.setStyle(TableStyle(style))
    elements += [tableau, Spacer(1, 6 * mm)]

    gagnant = rapport.get("gagnant")
    prime = rapport.get("prime")
    if gagnant:
        elements.append(Paragraph(
            f"Employé du mois : {gagnant['email']} — score {gagnant['score']}/100.", corps))
        if prime:
            elements.append(Paragraph(
                f"Prime proposée : {_f(prime['montant'])} — {prime['motif']} "
                f"({'validée' if prime['validee'] else 'en attente de validation RH'}).", corps))
    else:
        elements.append(Paragraph("Aucun pointage ce mois-ci : pas d'employé du mois.", corps))
    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph("Digi Com &amp; Technologies — Rapport généré automatiquement par le HUB.", corps))
    doc.build(elements)
    buf.seek(0)
    return buf
