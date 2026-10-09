# Generated on 2026-10-09 : type de document Facture / Proforma sur Invoice.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_invoice_envoyee_le_invoice_inscription_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='type_doc',
            field=models.CharField(choices=[('facture', 'Facture'), ('proforma', 'Proforma')], default='facture', help_text='Facture ou Proforma (affiché sur le document).', max_length=20),
        ),
    ]
