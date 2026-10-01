"""Tâches Celery — SPEC §10 : mails async, relances, rappels J-3 (mode eager sans broker)."""

from celery import shared_task


@shared_task
def envoyer_mail_async(sent_mail_id):
    from apps.mailing.models import SentMail

    SentMail.objects.get(id=sent_mail_id).expedier()


@shared_task
def rappel_conges_j3():
    """Congés validés dont début = J+3 -> mail employé + RH via template conge_rappel_j3 (SPEC §5.5.5)."""
    from datetime import date, timedelta

    from apps.mailing.services import send_templated_mail
    from apps.rh.models import Leave

    cibles = Leave.objects.filter(statut=Leave.STATUT_VALIDE, du_jour=date.today() + timedelta(days=3))
    n = 0
    for conge in cibles.select_related("employe__user"):
        mail = send_templated_mail(
            "conge_rappel_j3", conge.employe.user.email,
            {"nom": str(conge.employe.user.get_full_name() or conge.employe.user.username),
             "du": conge.du_jour.strftime("%d/%m/%Y"), "au": conge.au_jour.strftime("%d/%m/%Y")},
            department_slug="rh",
        )
        n += 1 if mail else 0
    return n


@shared_task
def relance_factures_impayees():
    """Factures envoyées non soldées -> statut impayée + mail relance_facture (SPEC §5.7)."""
    from apps.finance.models import Invoice
    from apps.mailing.services import send_templated_mail

    n = 0
    for f in Invoice.objects.filter(statut=Invoice.STATUT_ENVOYEE).select_related("client"):
        if f.solde > 0:
            f.statut = Invoice.STATUT_IMPAYEE
            f.save()
            send_templated_mail(
                "relance_facture", f.client.email,
                {"societe": f.client.nom_societe, "numero": f.numero,
                 "solde": f"{float(f.solde):,.0f}".replace(",", " ")},
                department_slug="finance", client=f.client,
            )
            n += 1
    return n
