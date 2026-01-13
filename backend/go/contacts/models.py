from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator


class ContactProfile(models.Model):
    """
    Erweiterte Kontaktinformationen für interne User.
    One-to-One Beziehung mit CustomUser für zusätzliche Kontaktdetails.
    """
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='contact_profile',
        verbose_name='Benutzer',
        primary_key=True
    )
    
    # Zusätzliche Telefonnummern
    phone_validator = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Telefonnummer muss im Format eingegeben werden: '+999999999'. Bis zu 15 Ziffern erlaubt."
    )
    
    work_extension = models.CharField(
        'Durchwahl',
        max_length=10,
        blank=True,
        help_text='z.B. 123 oder -123'
    )
    private_phone = models.CharField(
        'Privat Telefon',
        max_length=20,
        blank=True,
        validators=[phone_validator]
    )
    emergency_contact_name = models.CharField(
        'Notfallkontakt Name',
        max_length=200,
        blank=True
    )
    emergency_contact_phone = models.CharField(
        'Notfallkontakt Telefon',
        max_length=20,
        blank=True,
        validators=[phone_validator]
    )
    emergency_contact_relation = models.CharField(
        'Verhältnis zum Notfallkontakt',
        max_length=100,
        blank=True,
        help_text='z.B. Ehepartner, Eltern, Geschwister'
    )
    
    # Arbeitsort/Standort
    office_location = models.CharField(
        'Bürostandort',
        max_length=200,
        blank=True,
        help_text='z.B. Hamburg HQ, Außendienst, Home Office'
    )
    desk_number = models.CharField(
        'Schreibtisch/Raumnummer',
        max_length=50,
        blank=True
    )
    
    # Kommunikationspräferenzen
    preferred_contact_method = models.CharField(
        'Bevorzugte Kontaktmethode',
        max_length=20,
        choices=[
            ('email', 'E-Mail'),
            ('phone', 'Telefon'),
            ('mobile', 'Mobil'),
            ('teams', 'Teams/Chat'),
        ],
        default='email',
        blank=True
    )
    
    # Social/Collaboration
    teams_id = models.CharField(
        'Microsoft Teams ID',
        max_length=200,
        blank=True
    )
    slack_id = models.CharField(
        'Slack ID',
        max_length=200,
        blank=True
    )
    
    # Verfügbarkeit
    typical_work_hours = models.CharField(
        'Typische Arbeitszeiten',
        max_length=200,
        blank=True,
        help_text='z.B. Mo-Fr 8:00-16:30'
    )
    timezone = models.CharField(
        'Zeitzone',
        max_length=50,
        default='Europe/Berlin',
        blank=True
    )
    
    # Zusätzliche Notizen
    notes = models.TextField(
        'Notizen',
        blank=True,
        help_text='Interne Notizen (nur für HR/Admin sichtbar)'
    )
    
    # Sichtbarkeit
    is_visible_in_directory = models.BooleanField(
        'Im Verzeichnis sichtbar',
        default=True,
        help_text='Im internen Mitarbeiterverzeichnis anzeigen'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Kontaktprofil'
        verbose_name_plural = 'Kontaktprofile'
        ordering = ['user__last_name', 'user__first_name']
        indexes = [
            models.Index(fields=['office_location', 'is_visible_in_directory']),
            models.Index(fields=['is_visible_in_directory', 'user']),
        ]
    
    def __str__(self):
        return f"Kontakt: {self.user.get_full_name() or self.user.username}"
    
    def get_full_phone_number(self):
        """Kombiniert Telefonnummer mit Durchwahl"""
        phone = self.user.profile.phone_number if hasattr(self.user, 'profile') else ''
        if phone and self.work_extension:
            return f"{phone} {self.work_extension}"
        return phone or ''
    
    def get_primary_contact(self):
        """Gibt primäre Kontaktmethode zurück"""
        phone = self.user.profile.phone_number if hasattr(self.user, 'profile') else ''
        mobile = self.user.profile.mobile_number if hasattr(self.user, 'profile') else ''
        method_map = {
            'email': self.user.email,
            'phone': phone,
            'mobile': mobile,
            'teams': self.teams_id,
        }
        return method_map.get(self.preferred_contact_method, self.user.email)
    
    @property
    def has_emergency_contact(self):
        """Prüft ob Notfallkontakt hinterlegt ist"""
        return bool(self.emergency_contact_name and self.emergency_contact_phone)
    
    @property
    def department_display(self):
        """Kombiniert Abteilung und Standort für Anzeige"""
        parts = []
        # Get department from DepartmentMember relationship
        department_member = self.user.department_memberships.first()
        if department_member and department_member.department:
            parts.append(department_member.department.name)
        if self.office_location:
            parts.append(self.office_location)
        return ' - '.join(parts) if parts else 'Nicht zugewiesen'


