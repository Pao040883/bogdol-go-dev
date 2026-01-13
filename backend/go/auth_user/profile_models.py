"""
User Profile Models - Trennung von Authentifizierung und Profildaten
"""
from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator


class Company(models.Model):
    """Gesellschaften/Firmen im Unternehmensverbund"""
    name = models.CharField('Firmenname', max_length=200, unique=True)
    code = models.CharField('Firmenkürzel', max_length=20, unique=True)
    description = models.TextField('Beschreibung', blank=True)
    
    # Kontaktdaten
    address = models.TextField('Adresse', blank=True)
    phone = models.CharField('Telefon', max_length=50, blank=True)
    email = models.EmailField('E-Mail', blank=True)
    website = models.URLField('Website', blank=True)
    
    # Logo
    logo = models.ImageField('Logo', upload_to='companies/', blank=True, null=True)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Gesellschaft'
        verbose_name_plural = 'Gesellschaften'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Department(models.Model):
    """Abteilungen im Unternehmen"""
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='departments',
        verbose_name='Gesellschaft',
        null=True,  # Temporarily nullable for migration
        blank=True
    )
    name = models.CharField('Name', max_length=100)
    description = models.TextField('Beschreibung', blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_departments',
        verbose_name='Übergeordnete Abteilung'
    )
    code = models.CharField('Abteilungskürzel', max_length=20, blank=True)
    is_active = models.BooleanField('Aktiv', default=True)
    
    # KI-Suche: Keywords für bessere Auffindbarkeit
    search_keywords = models.TextField(
        'Such-Keywords',
        blank=True,
        help_text='Keywords für KI-Suche (z.B. "Computer, Handy, Hardware, IT-Support")'
    )
    
    # Organisationstyp für unterschiedliche Strukturen
    ORG_TYPE_CHOICES = [
        ('administration', 'Verwaltungsbereich'),
        ('operations', 'Betrieb'),
        ('other', 'Sonstiges'),
    ]
    org_type = models.CharField(
        'Organisationstyp',
        max_length=20,
        choices=ORG_TYPE_CHOICES,
        default='other'
    )
    
    # Stabsstelle?
    is_staff_department = models.BooleanField(
        'Stabsstelle',
        default=False,
        help_text='Stabsstellen werden im Organigramm direkt unter GF angezeigt'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Abteilung'
        verbose_name_plural = 'Abteilungen'
        ordering = ['name']
        indexes = [
            models.Index(fields=['parent', 'is_active']),
        ]
    
    def __str__(self):
        return self.name
    
    def get_full_path(self):
        """Gibt vollständigen Pfad zurück (z.B. 'IT > Development > Backend')"""
        path = [self.name]
        parent = self.parent
        while parent:
            path.insert(0, parent.name)
            parent = parent.parent
        return ' > '.join(path)


class DepartmentRole(models.Model):
    """Rollen innerhalb der Organisation"""
    name = models.CharField('Rollenbezeichnung', max_length=100)
    code = models.CharField('Kürzel', max_length=20, unique=True)
    
    # Hierarchieebene (1 = höchste Ebene)
    hierarchy_level = models.IntegerField(
        'Hierarchieebene',
        default=99,
        help_text='1=Geschäftsführung, 2=Bereichsleitung, etc.'
    )
    
    # Organisationstyp
    ORG_TYPE_CHOICES = [
        ('administration', 'Verwaltungsbereich'),
        ('operations', 'Betrieb'),
        ('both', 'Beide'),
    ]
    org_type = models.CharField(
        'Gilt für',
        max_length=20,
        choices=ORG_TYPE_CHOICES,
        default='both'
    )
    
    description = models.TextField('Beschreibung', blank=True)
    
    # KI-Suche: Keywords für bessere Auffindbarkeit
    search_keywords = models.TextField(
        'Such-Keywords',
        blank=True,
        help_text='Keywords für KI-Suche (z.B. "Führung, Management, Leitung")'
    )
    
    color = models.CharField('Farbe (Hex)', max_length=7, default='#3880ff')
    is_active = models.BooleanField('Aktiv', default=True)
    
    # Faktura-Zuweisungen
    can_receive_faktura_assignments = models.BooleanField(
        'Kann Faktura-Zuweisungen erhalten',
        default=False,
        help_text='Mitarbeiter mit dieser Rolle können von Faktura-Mitarbeitern zugewiesen werden (z.B. Service Manager)'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Organisationsrolle'
        verbose_name_plural = 'Organisationsrollen'
        ordering = ['hierarchy_level', 'name']
        indexes = [
            models.Index(fields=['org_type', 'hierarchy_level']),
        ]
    
    def __str__(self):
        return f"{self.name} (Level {self.hierarchy_level})"


class DepartmentMember(models.Model):
    """Zuordnung User <-> Department mit Rolle und Hierarchie"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='department_memberships',
        verbose_name='Mitarbeiter'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='memberships',
        verbose_name='Abteilung'
    )
    role = models.ForeignKey(
        DepartmentRole,
        on_delete=models.PROTECT,
        related_name='members',
        verbose_name='Rolle'
    )
    
    # Hierarchie innerhalb der Abteilung
    reports_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports',
        verbose_name='Berichtet an'
    )
    
    # Positionsbezeichnung (optional, zusätzlich zur Rolle)
    position_title = models.CharField(
        'Positionsbezeichnung',
        max_length=200,
        blank=True,
        help_text='z.B. "Senior Developer", "Key Account Manager"'
    )
    
    # Anzeigereihenfolge
    display_order = models.IntegerField('Anzeigereihenfolge', default=0)
    
    # Zeitraum
    start_date = models.DateField('Startdatum', null=True, blank=True)
    end_date = models.DateField('Enddatum', null=True, blank=True)
    
    is_primary = models.BooleanField(
        'Primäre Zuordnung',
        default=True,
        help_text='Falls User in mehreren Departments ist'
    )
    
    # Stabsstelle?
    is_staff_position = models.BooleanField(
        'Stabsstelle',
        default=False,
        help_text='Wird direkt unter GF im Organigramm angezeigt'
    )
    
    is_active = models.BooleanField('Aktiv', default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Abteilungsmitglied'
        verbose_name_plural = 'Abteilungsmitglieder'
        ordering = ['department', 'role__hierarchy_level', 'display_order']
        unique_together = [['user', 'department', 'role']]
        indexes = [
            models.Index(fields=['user', 'is_primary', 'is_active']),
            models.Index(fields=['department', 'is_active']),
            models.Index(fields=['reports_to']),
        ]
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.department.name} ({self.role.name})"


class Specialty(models.Model):
    """Fachbereiche innerhalb von Abteilungen"""
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='specialties',
        verbose_name='Abteilung'
    )
    name = models.CharField('Name', max_length=100)
    code = models.CharField('Kürzel', max_length=20, unique=True)
    description = models.TextField('Beschreibung', blank=True)
    
    # Hierarchie für zukünftige Unterfachbereiche
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_specialties',
        verbose_name='Übergeordneter Fachbereich'
    )
    
    # KI-Suche
    search_keywords = models.TextField(
        'Such-Keywords',
        blank=True,
        help_text='Keywords für KI-Suche (z.B. "Rechnungsstellung, Fakturierung")'
    )
    
    # Anzeigereihenfolge
    display_order = models.IntegerField('Anzeigereihenfolge', default=0)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Fachbereich'
        verbose_name_plural = 'Fachbereiche'
        ordering = ['department', 'display_order', 'name']
        unique_together = [['department', 'name']]
        indexes = [
            models.Index(fields=['department', 'is_active']),
            models.Index(fields=['parent']),
        ]
    
    def __str__(self):
        return f"{self.department.name} - {self.name}"
    
    def get_full_path(self):
        """Gibt vollständigen Pfad zurück (z.B. 'IT > Support > 1st Level')"""
        path = [self.name]
        parent = self.parent
        while parent:
            path.insert(0, parent.name)
            parent = parent.parent
        return ' > '.join(path)


class MemberSpecialty(models.Model):
    """Detaillierte Zuordnung Member → Specialty"""
    member = models.ForeignKey(
        DepartmentMember,
        on_delete=models.CASCADE,
        related_name='specialty_assignments',
        verbose_name='Abteilungsmitglied'
    )
    specialty = models.ForeignKey(
        Specialty,
        on_delete=models.CASCADE,
        related_name='member_assignments',
        verbose_name='Fachbereich'
    )
    
    # Kompetenzlevel (optional, für spätere Features)
    PROFICIENCY_CHOICES = [
        (1, 'Grundkenntnisse'),
        (2, 'Fortgeschritten'),
        (3, 'Experte'),
        (4, 'Kann andere schulen'),
    ]
    proficiency_level = models.IntegerField(
        'Kompetenzstufe',
        choices=PROFICIENCY_CHOICES,
        default=3
    )
    
    # Primärer Fachbereich innerhalb dieser Abteilung
    is_primary = models.BooleanField('Primär', default=False)
    
    # Zeitraum (optional, für historische Zuordnungen)
    start_date = models.DateField('Startdatum', null=True, blank=True)
    end_date = models.DateField('Enddatum', null=True, blank=True)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Fachbereichszuordnung'
        verbose_name_plural = 'Fachbereichszuordnungen'
        unique_together = [['member', 'specialty']]
        ordering = ['-is_primary', 'specialty__display_order']
        indexes = [
            models.Index(fields=['member', 'is_active']),
            models.Index(fields=['specialty', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.member.user.get_full_name()} - {self.specialty.name}"


class WorkorderAssignment(models.Model):
    """Feste Zuordnung: Einreicher → Faktur-Mitarbeiter"""
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workorder_processors',
        verbose_name='Einreichender User'
    )
    processor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workorder_submissions',
        verbose_name='Zuständiger Faktur-Mitarbeiter'
    )
    specialty = models.ForeignKey(
        Specialty,
        on_delete=models.CASCADE,
        verbose_name='Fachbereich'
    )
    
    # Automatisch erstellt oder manuell zugewiesen?
    is_auto_assigned = models.BooleanField('Automatisch zugewiesen', default=True)
    
    # Zeitraum
    valid_from = models.DateField('Gültig ab', null=True, blank=True)
    valid_until = models.DateField('Gültig bis', null=True, blank=True)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Arbeitsschein-Zuordnung'
        verbose_name_plural = 'Arbeitsschein-Zuordnungen'
        unique_together = [['submitter', 'processor', 'specialty']]
        indexes = [
            models.Index(fields=['submitter', 'is_active']),
            models.Index(fields=['processor', 'is_active']),
            models.Index(fields=['specialty']),
        ]
    
    def __str__(self):
        return f"{self.submitter.get_full_name()} → {self.processor.get_full_name()} ({self.specialty.name})"


class SubstituteAssignment(models.Model):
    """Vertretungsregelung bei Abwesenheit (transitive Kette)"""
    absence = models.ForeignKey(
        'absences.Absence',
        on_delete=models.CASCADE,
        related_name='substitute_assignments',
        verbose_name='Abwesenheit'
    )
    original_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='substituted_by',
        verbose_name='Abwesender User'
    )
    substitute_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='substituting_for',
        verbose_name='Vertretung'
    )
    
    # Optionale Einschränkung auf Fachbereiche
    specialties = models.ManyToManyField(
        Specialty,
        blank=True,
        related_name='substitute_assignments',
        verbose_name='Fachbereiche',
        help_text='Leer = alle Fachbereiche des abwesenden Users'
    )
    
    # Automatisch erstellt bei Abwesenheitsantrag
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Vertretungszuordnung'
        verbose_name_plural = 'Vertretungszuordnungen'
        indexes = [
            models.Index(fields=['original_user', 'is_active']),
            models.Index(fields=['substitute_user', 'is_active']),
            models.Index(fields=['absence']),
        ]
    
    def __str__(self):
        return f"{self.substitute_user.get_full_name()} vertritt {self.original_user.get_full_name()}"


class HRAssignment(models.Model):
    """
    Zuweisung Employee → HR-Mitarbeiter
    Wird genutzt für: Abwesenheiten, Sofortmeldung
    """
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hr_assignments',
        verbose_name='Mitarbeiter',
        help_text='Mitarbeiter der betreut wird'
    )
    hr_processor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assigned_hr_employees',
        verbose_name='HR-Mitarbeiter',
        help_text='HR-Mitarbeiter der zuständig ist'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Abteilung',
        help_text='Optional: Für welches Department gilt die Zuweisung'
    )
    
    # Zeitraum
    valid_from = models.DateField('Gültig ab', null=True, blank=True)
    valid_until = models.DateField('Gültig bis', null=True, blank=True)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'auth_user_hr_assignment'
        unique_together = [['employee', 'hr_processor']]
        verbose_name = 'HR-Zuweisung'
        verbose_name_plural = 'HR-Zuweisungen'
        indexes = [
            models.Index(fields=['employee', 'is_active']),
            models.Index(fields=['hr_processor', 'is_active']),
            models.Index(fields=['department']),
        ]
    
    def __str__(self):
        dept_info = f" ({self.department.name})" if self.department else ""
        return f"{self.employee.get_full_name()} → {self.hr_processor.get_full_name()}{dept_info}"


class FakturaAssignment(models.Model):
    """
    Zuweisung Employee → Faktura-Mitarbeiter
    Wird genutzt für: Arbeitsscheine (Workorders)
    """
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='faktura_assignments',
        verbose_name='Mitarbeiter',
        help_text='Mitarbeiter der betreut wird'
    )
    faktura_processor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assigned_faktura_employees',
        verbose_name='Faktura-Mitarbeiter',
        help_text='Faktura-Mitarbeiter der zuständig ist'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Abteilung',
        help_text='Optional: Für welches Department gilt die Zuweisung'
    )
    
    # Zeitraum
    valid_from = models.DateField('Gültig ab', null=True, blank=True)
    valid_until = models.DateField('Gültig bis', null=True, blank=True)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'auth_user_faktura_assignment'
        unique_together = [['employee', 'faktura_processor']]
        verbose_name = 'Faktura-Zuweisung'
        verbose_name_plural = 'Faktura-Zuweisungen'
        indexes = [
            models.Index(fields=['employee', 'is_active']),
            models.Index(fields=['faktura_processor', 'is_active']),
            models.Index(fields=['department']),
        ]
    
    def __str__(self):
        dept_info = f" ({self.department.name})" if self.department else ""
        return f"{self.employee.get_full_name()} → {self.faktura_processor.get_full_name()}{dept_info}"


class Team(models.Model):
    """Teams/Projektgruppen (optional, zusätzlich zu Abteilungen)"""
    name = models.CharField('Team-Name', max_length=100)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='teams',
        verbose_name='Abteilung'
    )
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_teams',
        verbose_name='Team-Lead'
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='teams',
        verbose_name='Mitglieder',
        blank=True
    )
    description = models.TextField('Beschreibung', blank=True)
    is_active = models.BooleanField('Aktiv', default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Team'
        verbose_name_plural = 'Teams'
        ordering = ['department', 'name']
    
    def __str__(self):
        return f"{self.department.name} - {self.name}"


class UserProfile(models.Model):
    """
    Profildaten getrennt von Authentifizierung.
    One-to-One mit CustomUser.
    """
    
    # One-to-One mit User (Primary Key)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name='Benutzer',
        primary_key=True
    )
    
    # === Basis-Informationen ===
    display_name = models.CharField(
        'Anzeigename',
        max_length=200,
        blank=True,
        help_text='Optional: Abweichender Anzeigename'
    )
    avatar = models.ImageField(
        'Profilbild',
        upload_to='avatars/',
        null=True,
        blank=True
    )
    bio = models.TextField(
        'Über mich',
        blank=True,
        max_length=500,
        help_text='Kurze Beschreibung (max. 500 Zeichen)'
    )
    
    # === Kontaktdaten ===
    phone_validator = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Format: '+999999999'. Bis zu 15 Ziffern."
    )
    
    phone_number = models.CharField(
        'Telefon',
        max_length=20,
        blank=True,
        validators=[phone_validator]
    )
    mobile_number = models.CharField(
        'Mobil',
        max_length=20,
        blank=True,
        validators=[phone_validator]
    )
    work_extension = models.CharField(
        'Durchwahl',
        max_length=10,
        blank=True
    )
    email_backup = models.EmailField(
        'Backup-E-Mail',
        blank=True,
        help_text='Alternative E-Mail-Adresse'
    )
    
    # === Organisation & Hierarchie ===
    
    # Gesellschaftszuordnung (User können mehreren Gesellschaften zugeordnet sein)
    companies = models.ManyToManyField(
        'Company',
        related_name='members',
        verbose_name='Gesellschaften',
        blank=True,
        help_text='User kann mehreren Gesellschaften zugeordnet sein'
    )
    
    # Job & Position
    job_title = models.CharField(
        'Berufsbezeichnung',
        max_length=100,
        blank=True
    )
    employee_id = models.CharField(
        'Personalnummer',
        max_length=50,
        blank=True,
        unique=True,
        null=True
    )
    
    # Hierarchie (kann mehrere haben - Matrix-Organisation)
    direct_supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports',
        verbose_name='Direkter Vorgesetzter'
    )
    functional_supervisors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='functional_reports',
        verbose_name='Fachliche Vorgesetzte',
        blank=True,
        help_text='Für Matrix-Organisation'
    )
    
    # === Zuständigkeiten & Skills (für KI-Suche) ===
    responsibilities = models.TextField(
        'Zuständigkeiten',
        blank=True,
        help_text='Wofür ist diese Person zuständig? (Freitext für KI-Suche)'
    )
    expertise_areas = models.TextField(
        'Fachgebiete',
        blank=True,
        help_text='Expertise-Bereiche (Komma-separiert oder Freitext)'
    )
    
    # Für semantische Suche (wird automatisch generiert)
    embedding_vector = models.JSONField(
        'Embedding Vektor',
        null=True,
        blank=True,
        help_text='Vector Embedding für KI-Suche (automatisch generiert)'
    )
    embedding_updated_at = models.DateTimeField(
        'Embedding aktualisiert',
        null=True,
        blank=True
    )
    
    # === Standort & Arbeitszeit ===
    office_location = models.CharField(
        'Bürostandort',
        max_length=200,
        blank=True
    )
    desk_number = models.CharField(
        'Schreibtisch/Raum',
        max_length=50,
        blank=True
    )
    work_hours = models.CharField(
        'Arbeitszeiten',
        max_length=200,
        blank=True,
        help_text='z.B. Mo-Fr 8:00-16:30'
    )
    timezone = models.CharField(
        'Zeitzone',
        max_length=50,
        default='Europe/Berlin'
    )
    
    # === Arbeitsbeginn & Vertrag ===
    start_date = models.DateField(
        'Eintrittsdatum',
        null=True,
        blank=True
    )
    contract_type = models.CharField(
        'Vertragsart',
        max_length=50,
        choices=[
            ('full_time', 'Vollzeit'),
            ('part_time', 'Teilzeit'),
            ('contract', 'Befristet'),
            ('freelance', 'Freiberufler'),
            ('intern', 'Praktikant'),
        ],
        blank=True
    )
    
    # === Urlaub ===
    vacation_entitlement = models.PositiveIntegerField(
        'Urlaubsanspruch',
        default=30
    )
    carryover_vacation = models.PositiveIntegerField(
        'Übertrag Vorjahr',
        default=0
    )
    vacation_year = models.PositiveIntegerField(
        'Urlaubsjahr',
        default=2026
    )
    
    # === Notfallkontakt ===
    emergency_contact_name = models.CharField(
        'Notfallkontakt Name',
        max_length=200,
        blank=True
    )
    emergency_contact_phone = models.CharField(
        'Notfallkontakt Telefon',
        max_length=20,
        blank=True
    )
    emergency_contact_relation = models.CharField(
        'Verhältnis',
        max_length=100,
        blank=True
    )
    
    # === Integration (Blink, etc.) ===
    blink_id = models.IntegerField('Blink ID', null=True, blank=True, db_index=True)
    blink_company = models.IntegerField('Blink Company', null=True, blank=True)
    
    # === End-to-End Encryption ===
    public_key = models.TextField(
        'RSA Public Key',
        blank=True,
        help_text='RSA public key for end-to-end encryption (base64 encoded)'
    )
    public_key_updated_at = models.DateTimeField(
        'Public Key Updated',
        null=True,
        blank=True,
        help_text='When the public key was last updated'
    )
    
    # === Sichtbarkeit & Präferenzen ===
    is_searchable = models.BooleanField(
        'Im Verzeichnis suchbar',
        default=True
    )
    show_phone_in_directory = models.BooleanField(
        'Telefon anzeigen',
        default=True
    )
    show_email_in_directory = models.BooleanField(
        'E-Mail anzeigen',
        default=True
    )
    preferred_contact_method = models.CharField(
        'Bevorzugte Kontaktmethode',
        max_length=20,
        choices=[
            ('email', 'E-Mail'),
            ('phone', 'Telefon'),
            ('mobile', 'Mobil'),
            ('chat', 'Chat'),
        ],
        default='email'
    )
    
    # === Collaboration Tools ===
    teams_id = models.CharField('Microsoft Teams ID', max_length=200, blank=True)
    slack_id = models.CharField('Slack ID', max_length=200, blank=True)
    
    # === Arbeitsschein-Zuständigkeit ===
    billing_responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_service_managers',
        verbose_name='Zuständiger Faktura-Mitarbeiter',
        help_text='Wer ist für die Abrechnung von Arbeitsscheinen zuständig?'
    )
    
    # === Interne Notizen (nur HR/Admin) ===
    internal_notes = models.TextField(
        'Interne Notizen',
        blank=True,
        help_text='Nur für HR/Admins sichtbar'
    )
    
    # === Timestamps ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Benutzerprofil'
        verbose_name_plural = 'Benutzerprofile'
        ordering = ['user__last_name', 'user__first_name']
        indexes = [
            models.Index(fields=['direct_supervisor']),
            models.Index(fields=['office_location']),
            models.Index(fields=['employee_id']),
            models.Index(fields=['is_searchable']),
        ]
    
    def __str__(self):
        return f"Profil: {self.user.get_full_name() or self.user.username}"
    
    def get_display_name(self):
        """Gibt Anzeigenamen zurück (oder Fallback)"""
        if self.display_name:
            return self.display_name
        return self.user.get_full_name() or self.user.username
    
    def get_full_phone(self):
        """Kombiniert Telefon mit Durchwahl"""
        if self.phone_number and self.work_extension:
            return f"{self.phone_number} {self.work_extension}"
        return self.phone_number or ''
    
    def get_all_supervisors(self):
        """Gibt alle Vorgesetzten zurück (direkt + funktional)"""
        supervisors = []
        if self.direct_supervisor:
            supervisors.append(self.direct_supervisor)
        supervisors.extend(self.functional_supervisors.all())
        return supervisors
    
    def needs_embedding_update(self):
        """Prüft ob Embedding neu generiert werden muss"""
        if not self.embedding_vector:
            return True
        if not self.embedding_updated_at:
            return True
        # Wenn Profil nach letztem Embedding aktualisiert wurde
        return self.updated_at > self.embedding_updated_at
    
    @property
    def full_name(self):
        """Shortcut für vollständigen Namen"""
        return self.user.get_full_name() or self.user.username
    
    # === COMPUTED PROPERTIES - Organisation via DepartmentMember ===
    
    @property
    def primary_department_membership(self):
        """Gibt primäre DepartmentMember-Zuordnung zurück"""
        if not hasattr(self, '_cached_primary_membership'):
            self._cached_primary_membership = self.user.department_memberships.filter(
                is_primary=True, is_active=True
            ).select_related('department', 'role').first()
        return self._cached_primary_membership
    
    @property
    def primary_department(self):
        """Gibt primäre Abteilung zurück"""
        membership = self.primary_department_membership
        return membership.department if membership else None
    
    @property
    def primary_role(self):
        """Gibt primäre Rolle zurück"""
        membership = self.primary_department_membership
        return membership.role if membership else None
    
    @property
    def primary_specialties(self):
        """Gibt primäre Fachbereiche zurück"""
        membership = self.primary_department_membership
        if membership:
            return [
                assignment.specialty 
                for assignment in membership.specialty_assignments.filter(
                    is_primary=True, is_active=True
                ).select_related('specialty')
            ]
        return []
    
    def get_all_specialties(self):
        """Gibt alle Fachbereiche über alle Abteilungen zurück"""
        try:
            from .models import MemberSpecialty
            return MemberSpecialty.objects.filter(
                member__user=self.user,
                member__is_active=True,
                is_active=True
            ).select_related('specialty', 'member__department')
        except ImportError:
            return []
    
    def get_all_department_memberships(self):
        """Gibt alle aktiven Abteilungszuordnungen zurück"""
        return self.user.department_memberships.filter(
            is_active=True
        ).select_related('department', 'role').order_by('-is_primary', 'display_order')


class UserPresence(models.Model):
    """
    Online-Status für Chat & Collaboration
    """
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('away', 'Abwesend'),
        ('busy', 'Beschäftigt'),
        ('offline', 'Offline'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='presence',
        primary_key=True
    )
    
    status = models.CharField(
        'Status',
        max_length=20,
        choices=STATUS_CHOICES,
        default='offline'
    )
    status_message = models.CharField(
        'Statusnachricht',
        max_length=200,
        blank=True,
        help_text='z.B. "Im Meeting bis 15:00"'
    )
    is_available_for_chat = models.BooleanField(
        'Chat verfügbar',
        default=True
    )
    last_seen = models.DateTimeField(
        'Zuletzt online',
        auto_now=True
    )
    
    # WebSocket Connection Tracking
    websocket_channel_name = models.CharField(
        'WebSocket Channel',
        max_length=255,
        blank=True,
        help_text='Django Channels WebSocket Name'
    )
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Benutzerstatus'
        verbose_name_plural = 'Benutzerstatus'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_status_display()}"
    
    def set_online(self, channel_name=None):
        """Setzt Status auf online"""
        self.status = 'online'
        if channel_name:
            self.websocket_channel_name = channel_name
        self.save(update_fields=['status', 'websocket_channel_name', 'updated_at'])
    
    def set_offline(self):
        """Setzt Status auf offline"""
        self.status = 'offline'
        self.websocket_channel_name = ''
        self.save(update_fields=['status', 'websocket_channel_name', 'updated_at'])
