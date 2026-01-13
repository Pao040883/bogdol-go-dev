# Migration for billing_responsible field in UserProfile

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth_user', '0015_department_search_keywords_and_more'),  # Adjust to latest migration
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='billing_responsible',
            field=models.ForeignKey(
                blank=True,
                help_text='Wer ist für die Abrechnung von Arbeitsscheinen zuständig?',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='managed_service_managers',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Zuständiger Faktura-Mitarbeiter'
            ),
        ),
    ]
