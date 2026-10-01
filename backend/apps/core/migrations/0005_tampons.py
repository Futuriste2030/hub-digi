# Tampons société : cachets + signatures (finance et juridique).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_groupechat'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='cachet_finance',
            field=models.ImageField(blank=True, null=True, upload_to='cachets/'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='signature_finance',
            field=models.ImageField(blank=True, null=True, upload_to='cachets/'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='cachet_juridique',
            field=models.ImageField(blank=True, null=True, upload_to='cachets/'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='signature_juridique',
            field=models.ImageField(blank=True, null=True, upload_to='cachets/'),
        ),
    ]
