# Generated migration for billing workflow fields

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workorders', '0004_alter_workobject_client'),
    ]

    operations = [
        # 1. Submitted Workflow
        migrations.AddField(
            model_name='workorder',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Eingereicht am'),
        ),
        migrations.AddField(
            model_name='workorder',
            name='submitted_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='submitted_workorders',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Eingereicht von'
            ),
        ),
        
        # 2. Billing Review Workflow
        migrations.AddField(
            model_name='workorder',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Abgerechnet am'),
        ),
        migrations.AddField(
            model_name='workorder',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_workorders',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Abgerechnet von'
            ),
        ),
        
        # 3. Update scanned_document to accept PDF
        migrations.AlterField(
            model_name='workorder',
            name='scanned_document',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to='workorders/scans/',
                verbose_name='Gescannter Arbeitsschein (PDF/Bild)'
            ),
        ),
        
        # 4. Add new status choices
        migrations.AlterField(
            model_name='workorder',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Entwurf'),
                    ('in_progress', 'In Bearbeitung'),
                    ('completed', 'Abgeschlossen'),
                    ('signed', 'Unterschrieben'),
                    ('submitted', 'Eingereicht'),
                    ('billed', 'Abgerechnet'),
                    ('cancelled', 'Storniert'),
                ],
                default='draft',
                max_length=20,
                verbose_name='Status'
            ),
        ),
        
        # 5. Add index for filtering
        migrations.AddIndex(
            model_name='workorder',
            index=models.Index(fields=['status', '-submitted_at'], name='workorders_status_submitted_idx'),
        ),
    ]
