# Generated migration for manual_duration_days field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('absences', '0007_enhance_absence_workflow'),
    ]

    operations = [
        migrations.AddField(
            model_name='absence',
            name='manual_duration_days',
            field=models.PositiveIntegerField(blank=True, help_text='Manuell eingegebene Anzahl Arbeitstage (überschreibt automatische Berechnung)', null=True),
        ),
    ]
