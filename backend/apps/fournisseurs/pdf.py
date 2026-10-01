"""PDF achats (fournisseurs) — même charte que apps.finance.pdf (ReportLab).

Documents : bon de commande (BDC), bon de livraison (BDL),
facture fournisseur (ACHAT), reçu de paiement fournisseur.
"""

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer

from apps.finance.pdf import (
    _base,
    _blocs,
    _date_fr,
    _emetteur,
    _gras,
    _montant,
    _pied,
    _table_lignes,
    _totaux,
    propre,
)


def _fournisseur_lignes(fournisseur, extra=None):
    lignes = [_gras(fournisseur.nom_societe), propre(fournisseur.adresse),
              propre(fournisseur.phone), propre(fournisseur.email)]
    if extra:
        lignes.append(propre(extra))
    return lignes


def pdf_bon_commande(commande):
    doc, story, buf, normal, soc, gras, droite, droite_gras = _base(
        "Bon de commande", commande.numero or "—")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    lignes = list(commande.lignes.all())
    ttc = sum(float(l.montant or 0) * float(l.quantite or 0) for l in lignes)
    story.append(Paragraph(
        f"Émis le <b>{_date_fr(commande.cree_le)}</b> · Livraison prévue "
        f"<b>{_date_fr(commande.livraison_prevue)}</b> · Statut "
        f"<b>{propre(commande.get_statut_display())}</b>", normal))
    if commande.objet:
        story.append(Paragraph(f"Objet : <b>{propre(commande.objet)}</b>", normal))
    story.append(Spacer(1, 4 * mm))
    story.append(_blocs(normal, "Émetteur", _emetteur(soc), "Fournisseur",
                        _fournisseur_lignes(commande.fournisseur)))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, lignes))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, ttc))
    story += _pied(normal, soc)
    doc.build(story)
    buf.seek(0)
    return buf


def pdf_bon_livraison(livraison):
    doc, story, buf, normal, soc, gras, droite, droite_gras = _base(
        "Bon de livraison", livraison.numero or "—")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    lignes = list(livraison.lignes.all())
    ttc = sum(float(l.montant or 0) * float(l.quantite or 0) for l in lignes)
    ref_bc = livraison.commande.numero if livraison.commande else "—"
    story.append(Paragraph(
        f"Livré le <b>{_date_fr(livraison.date_livraison)}</b> · Bon de commande "
        f"<b>{propre(ref_bc)}</b> · Statut "
        f"<b>{propre(livraison.get_statut_display())}</b>", normal))
    story.append(Spacer(1, 4 * mm))
    story.append(_blocs(normal, "Réceptionné par", _emetteur(soc), "Fournisseur",
                        _fournisseur_lignes(livraison.fournisseur)))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, lignes))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, ttc))
    story += _pied(normal, soc)
    doc.build(story)
    buf.seek(0)
    return buf


def pdf_facture_fournisseur(facture):
    doc, story, buf, normal, soc, gras, droite, droite_gras = _base(
        "Facture fournisseur", facture.numero or "—")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    lignes = list(facture.lignes.all())
    ref_bc = facture.commande.numero if facture.commande else "—"
    story.append(Paragraph(
        f"Reçue le <b>{_date_fr(facture.cree_le)}</b> · Bon de commande "
        f"<b>{propre(ref_bc)}</b> · Réf. fournisseur "
        f"<b>{propre(facture.reference_fournisseur or '—')}</b> · Statut "
        f"<b>{propre(facture.get_statut_display())}</b>", normal))
    if facture.objet:
        story.append(Paragraph(f"Objet : <b>{propre(facture.objet)}</b>", normal))
    story.append(Spacer(1, 4 * mm))
    story.append(_blocs(normal, "Payeur", _emetteur(soc), "Fournisseur",
                        _fournisseur_lignes(facture.fournisseur,
                                            f"Échéance : {_date_fr(facture.echeance)}")))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, lignes))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, facture.total))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Payé : <b>{_montant(facture.paye)}</b> — Solde dû : <b>{_montant(facture.solde)}</b>",
        normal))
    story += _pied(normal, soc)
    doc.build(story)
    buf.seek(0)
    return buf


def pdf_paiement_fournisseur(paiement):
    facture = paiement.facture
    doc, story, buf, normal, soc, gras, droite, droite_gras = _base(
        "Reçu de paiement fournisseur", paiement.numero or f"PAY-{paiement.pk:06d}")
    st = {"normal": normal, "gras": gras, "droite": droite, "droite_gras": droite_gras}
    story.append(Paragraph(
        f"Payé le <b>{_date_fr(paiement.date)}</b> · Facture "
        f"<b>{propre(facture.numero)}</b> · Moyen "
        f"<b>{propre(paiement.get_moyen_display())}</b>", normal))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        f"<font size=15 color='#12855a'><b>Montant versé : {_montant(paiement.montant)}</b></font>",
        normal))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Versé à <b>{propre(facture.fournisseur.nom_societe)}</b> — règlement "
        f"{propre(facture.numero)}", normal))
    story.append(Spacer(1, 4 * mm))
    story.append(_blocs(normal, "Payeur", _emetteur(soc), "Bénéficiaire",
                        _fournisseur_lignes(facture.fournisseur,
                                            f"Facture {facture.numero}")))
    story.append(Spacer(1, 4 * mm))
    story.append(_table_lignes(st, facture.lignes.all()))
    story.append(Spacer(1, 3 * mm))
    story.append(_totaux(st, facture.total))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Réf. transaction : <b>{propre(paiement.ref_transaction or '—')}</b>", normal))
    story += _pied(normal, soc)
    doc.build(story)
    buf.seek(0)
    return buf
