# Generated : groupes de chat style Slack (général + sous-groupes).

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_directmessage'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='GroupeChat',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100, unique=True)),
                ('general', models.BooleanField(default=False, help_text='Groupe général : tous les internes en sont membres')),
                ('cree_le', models.DateTimeField(auto_now_add=True)),
                ('cree_par', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='groupes_crees', to=settings.AUTH_USER_MODEL)),
                ('membres', models.ManyToManyField(blank=True, related_name='groupes_chat', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-general', 'nom'],
            },
        ),
        migrations.AddField(
            model_name='directmessage',
            name='groupe',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='core.groupechat'),
        ),
        migrations.AlterField(
            model_name='directmessage',
            name='destinataire',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='messages_recus', to=settings.AUTH_USER_MODEL),
        ),
    ]
