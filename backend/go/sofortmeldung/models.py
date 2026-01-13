from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class SofortmeldungStatus(models.TextChoices):
    """Status-Choices für detaillierten Workflow"""
    IN_BEARBEITUNG = 'IN_BEARBEITUNG', 'In Bearbeitung'
    GESENDET = 'GESENDET', 'Gesendet'
    FEHLGESCHLAGEN = 'FEHLGESCHLAGEN', 'Fehlgeschlagen'
    STORNIERUNG_ANGEFRAGT = 'STORNIERUNG_ANGEFRAGT', 'Stornierung angefragt'
    STORNIERT = 'STORNIERT', 'Storniert'


class Sofortmeldung(models.Model):
    """Model definition for Sofortmeldung (DEÜV-Meldung zum Arbeitsbeginn)."""

    companyNumber = models.CharField('Firmennummer', max_length=50, default='15308598')
    insurance_number = models.CharField('Sozialversicherungsnummer', max_length=12, blank=True, null=True)
    first_name = models.CharField('Vorname', max_length=255)
    last_name = models.CharField('Nachname', max_length=255)
    citizenship = models.DecimalField('Staatsangehörigkeit', max_digits=3, decimal_places=0, null=True, blank=True)
    group = models.DecimalField('Personengruppenschlüssel', max_digits=3, decimal_places=0)
    start_date = models.DateField('Vertragsbeginn')
    
    birth_land = models.CharField('Geburtsland (Staatenkennzeichen)', max_length=3, blank=True, null=True)
    birth_gender = models.CharField('Geschlecht (m/w/d/x)', max_length=1, choices=[('M', 'Männlich'), ('W', 'Weiblich'), ('D', 'Divers'), ('X', 'Unbestimmt')], blank=True, null=True)
    birth_name = models.CharField('Geburtsname', max_length=255, blank=True, null=True)
    birth_date = models.DateField('Geburtsdatum', blank=True, null=True)
    birth_place = models.CharField('Geburtsort', max_length=255, blank=True, null=True)

    country_code = models.CharField('Wohnland', max_length=2, default='D', blank=True, null=True)
    city_name = models.CharField('Wohnort', max_length=255, blank=True, null=True)
    zip_code = models.CharField('Postleitzahl', max_length=10, blank=True, null=True)
    street_name = models.CharField('Straße', max_length=255, blank=True, null=True)

    createdAt = models.DateTimeField('Erstellt am', auto_now_add=True)
    createdBy = models.ForeignKey(User, verbose_name='Erstellt von', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_sofortmeldungen')

    # Status (Boolean für Legacy-Kompatibilität)
    status = models.BooleanField('Status (Legacy)', default=False)
    
    # ❗ NEU: Detaillierter Status
    status_detail = models.CharField(
        'Status Detail',
        max_length=50,
        choices=SofortmeldungStatus.choices,
        default=SofortmeldungStatus.IN_BEARBEITUNG,
        db_index=True
    )
    
    tan = models.CharField('TAN-Nummer', max_length=255, default='', blank=True, null=True)
    url = models.URLField('PDF-Link', max_length=500, default='', blank=True, null=True)
    
    # ❗ NEU: Stornierungswunsch
    cancellation_requested = models.BooleanField('Stornierung angefragt', default=False, db_index=True)
    cancellation_requested_at = models.DateTimeField('Stornierung angefragt am', null=True, blank=True)
    cancellation_reason = models.TextField('Stornierungsgrund', blank=True, null=True)
    cancellation_requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_sofortmeldung_cancellations',
        verbose_name='Stornierung angefragt von'
    )
    
    # ❗ NEU: Optional - HR-Zuweisung (falls nicht über HRAssignment)
    assigned_hr = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_sofortmeldungen',
        verbose_name='Zugewiesener HR-Mitarbeiter'
    )

    class Meta:
        verbose_name = 'Sofortmeldung'
        verbose_name_plural = 'Sofortmeldungen'
        ordering = ['-createdAt']
        indexes = [
            models.Index(fields=['status', '-createdAt']),
            models.Index(fields=['status_detail', '-createdAt']),  # NEU
            models.Index(fields=['insurance_number']),
            models.Index(fields=['start_date']),
            models.Index(fields=['createdBy', '-createdAt']),
            models.Index(fields=['cancellation_requested', '-createdAt']),  # NEU
        ]
        permissions = [
            ("request_cancellation_sofortmeldung", "Can request cancellation"),
            ("view_all_sofortmeldungen", "Can view all sofortmeldungen (toggle)"),
        ]

    def __str__(self):
        """String representation of Sofortmeldung."""
        # Status-Symbol basiert auf status_detail
        if self.status_detail == SofortmeldungStatus.GESENDET:
            status_text = '✓'
        elif self.status_detail == SofortmeldungStatus.FEHLGESCHLAGEN:
            status_text = '✗'
        elif self.status_detail == SofortmeldungStatus.STORNIERUNG_ANGEFRAGT:
            status_text = '⚠'
        elif self.status_detail == SofortmeldungStatus.STORNIERT:
            status_text = '⊘'
        else:
            status_text = '⋯'
        
        return f"{status_text} {self.first_name} {self.last_name} – {self.start_date.strftime('%d.%m.%Y') if self.start_date else 'Kein Datum'}"



