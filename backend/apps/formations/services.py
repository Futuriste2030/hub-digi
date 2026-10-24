"""Service attestations — génération unitaire et génération par formation.

Règles :
- une attestation par inscription (OneToOne) — la regénération ne crée pas
  de doublon, elle met à jour la mention si on le demande explicitement ;
- le numéro est figé à la création (ATT-2026-0012) : il est imprimé sur le
  document ET porté par le lien public de vérification ;
- seules les inscriptions éligibles (statut dans `statuts`) sont concernées :
  « terminée » par défaut (la formation a été suivie), « confirmée » en
  option (inscription validée, passage non encore cloturé).
"""

from django.utils import timezone

from .models import AttestationFormation, InscriptionFormation

# Statuts d'inscription éligibles à une attestation.
STATUTS_DEFAUT = (InscriptionFormation.STATUT_TERMINEE,)


def eligible(inscription, statuts=None):
    """Cette inscription peut-elle recevoir une attestation ?"""
    return (inscription.statut or "") in (statuts or STATUTS_DEFAUT)


def generer_attestation(inscription, mention="", date_delivrance=None, force=False):
    """Crée l'attestation d'une inscription.

    Retourne (attestation, creee). `force` ne régénère PAS le numéro : il
    remplace seulement la mention et la date de délivrance (le document reste
    le même aux yeux du recipient, avec un texte mis à jour).
    """
    existante = AttestationFormation.objects.filter(inscription=inscription).first()
    if existante is not None:
        if force:
            if mention:
                existante.mention = mention
            if date_delivrance:
                existante.date_delivrance = date_delivrance
            existante.save(update_fields=["mention", "date_delivrance"])
        return existante, False
    attestation = AttestationFormation.objects.create(
        inscription=inscription,
        mention=mention or "",
        date_delivrance=date_delivrance or timezone.localdate(),
    )
    return attestation, True


def generer_attestations_formation(formation, statuts=None, mention="",
                                   date_delivrance=None, force=False):
    """Génère les attestations de TOUTES les inscriptions éligibles d'une formation.

    Retourne un récapitulatif : creees / existantes / ignorees (avec motif)."""
    statuts = statuts or STATUTS_DEFAUT
    creees, existantes, ignorees = [], [], []
    inscriptions = (formation.inscriptions
                    .select_related("participant")
                    .order_by("cree_le"))
    for inscription in inscriptions:
        if not eligible(inscription, statuts):
            ignorees.append({
                "inscription": inscription.reference,
                "participant": inscription.participant.full_name,
                "motif": f"statut « {inscription.get_statut_display()} »",
            })
            continue
        attestation, creee = generer_attestation(
            inscription, mention=mention, date_delivrance=date_delivrance, force=force)
        if creee:
            creees.append(attestation)
        else:
            existantes.append(attestation)
    return {
        "formation": formation.titre,
        "formation_id": formation.id,
        "creees": creees,
        "existantes": existantes,
        "ignorees": ignorees,
    }
