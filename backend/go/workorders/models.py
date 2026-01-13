from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class WorkOrderClient(models.Model):
    """Kunde/Rechnungsempfänger"""
    name = models.CharField('Firmenname', max_length=200)
    street = models.CharField('Straße', max_length=200, blank=True)
    postal_code = models.CharField('PLZ', max_length=10, blank=True)
    city = models.CharField('Stadt', max_length=100, blank=True)
    phone = models.CharField('Telefon', max_length=50, blank=True)
    email = models.EmailField('E-Mail', blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField('Aktiv', default=True)
    
    class Meta:
        verbose_name = 'Kunde'
        verbose_name_plural = 'Kunden'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class WorkObject(models.Model):
    """Objekt/Arbeitsort"""
    client = models.ForeignKey(
        WorkOrderClient,
        on_delete=models.CASCADE,
        related_name='work_objects',
        verbose_name='Kunde'
    )
    name = models.CharField('Objektname', max_length=200)
    street = models.CharField('Straße', max_length=200, blank=True)
    postal_code = models.CharField('PLZ', max_length=10, blank=True)
    city = models.CharField('Stadt', max_length=100, blank=True)
    
    # Ansprechpartner vor Ort
    contact_person = models.CharField('Ansprechpartner', max_length=200, blank=True)
    contact_phone = models.CharField('Telefon Ansprechpartner', max_length=50, blank=True)
    
    notes = models.TextField('Notizen', blank=True)
    is_active = models.BooleanField('Aktiv', default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Objekt'
        verbose_name_plural = 'Objekte'
        ordering = ['client__name', 'name']
    
    def __str__(self):
        return f"{self.client.name} - {self.name}"


class WorkOrderTemplate(models.Model):
    """Vorlage für wiederkehrende Arbeitsscheine"""
    
    name = models.CharField('Vorlagenname', max_length=200)
    description = models.TextField('Beschreibung', blank=True)
    
    # Kunde und Objekt (vorausgefüllt)
    client = models.ForeignKey(
        WorkOrderClient,
        on_delete=models.PROTECT,
        related_name='templates',
        verbose_name='Kunde'
    )
    work_object = models.ForeignKey(
        WorkObject,
        on_delete=models.PROTECT,
        related_name='templates',
        verbose_name='Objekt',
        null=True,
        blank=True
    )
    
    # Arbeitsdetails (vorausgefüllt)
    work_type = models.CharField('Arbeitsumfang', max_length=200)
    work_description = models.TextField('Arbeitsbeschreibung', blank=True)
    work_days = models.IntegerField('Anzahl Arbeitstage', default=1)
    work_schedule = models.CharField('Arbeitszeit', max_length=200, blank=True)
    
    # Notizen (vorausgefüllt)
    customer_notes = models.TextField('Kundennotizen', blank=True)
    internal_notes = models.TextField('Interne Notizen', blank=True)
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Arbeitsschein-Vorlage'
        verbose_name_plural = 'Arbeitsschein-Vorlagen'
        ordering = ['client__name', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.client.name})"
    
    def create_work_order(self, start_date, end_date, project_number=''):
        """Erstelle einen Arbeitsschein aus dieser Vorlage"""
        from django.utils import timezone
        
        # Generiere Auftragsnummer
        year = timezone.now().year
        count = WorkOrder.objects.filter(
            order_number__startswith=f'AS-{year}'
        ).count() + 1
        order_number = f'AS-{year}-{count:04d}'
        
        work_order = WorkOrder.objects.create(
            template=self,
            order_number=order_number,
            project_number=project_number,
            client=self.client,
            work_object=self.work_object,
            work_type=self.work_type,
            work_description=self.work_description,
            start_date=start_date,
            end_date=end_date,
            work_days=self.work_days,
            work_schedule=self.work_schedule,
            customer_notes=self.customer_notes,
            internal_notes=self.internal_notes,
            status='draft'
        )
        
        return work_order



class WorkOrder(models.Model):
    """Arbeitsschein"""
    
    STATUS_CHOICES = [
        ('draft', 'Entwurf'),
        ('in_progress', 'In Bearbeitung'),
        ('completed', 'Abgeschlossen'),
        ('signed', 'Unterschrieben'),
        ('submitted', 'Eingereicht'),
        ('billed', 'Abgerechnet'),
        ('cancelled', 'Storniert'),
    ]
    
    # Referenzen
    order_number = models.CharField('Auftragsnummer', max_length=50, unique=True)
    project_number = models.CharField('Projektnummer', max_length=50, blank=True)
    object_number = models.CharField('Objektnummer', max_length=50, blank=True)
    
    # Vorlage (falls aus Vorlage erstellt)
    template = models.ForeignKey(
        WorkOrderTemplate,
        on_delete=models.SET_NULL,
        related_name='work_orders',
        verbose_name='Vorlage',
        null=True,
        blank=True
    )
    
    # Kunde und Objekt
    client = models.ForeignKey(
        WorkOrderClient,
        on_delete=models.PROTECT,
        related_name='work_orders',
        verbose_name='Kunde',
        null=True,
        blank=True
    )
    work_object = models.ForeignKey(
        WorkObject,
        on_delete=models.PROTECT,
        related_name='work_orders',
        verbose_name='Objekt',
        null=True,
        blank=True
    )
    
    # Arbeitsdetails
    work_type = models.CharField('Arbeitsumfang', max_length=200)
    work_description = models.TextField('Beschreibung', blank=True)
    
    # Zeitraum
    start_date = models.DateField('Datum von')
    end_date = models.DateField('Datum bis')
    
    # Leistungsmonat für Haklisten-Match
    leistungsmonat = models.CharField(
        'Leistungsmonat',
        max_length=7,
        help_text='Monat für den die Leistung abgerechnet wird (Format: YYYY-MM)',
        blank=True,
        null=True
    )
    leistungsmonat_ocr_confidence = models.FloatField(
        'OCR-Konfidenz Leistungsmonat',
        null=True,
        blank=True,
        help_text='Konfidenz-Score der OCR-Erkennung für Leistungsmonat (0-100)'
    )
    month = models.CharField('Monat', max_length=20, blank=True)
    work_days = models.PositiveIntegerField('Arbeitstage')
    work_schedule = models.CharField('Arbeitszeit', max_length=100, blank=True, 
                                     help_text='z.B. "5 x wö. Mo-Fr"')
    
    # Mitarbeiter
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_orders',
        verbose_name='Zugewiesen an'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_work_orders',
        verbose_name='Erstellt von'
    )
    
    # Status
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Billing Workflow (NEU)
    submitted_at = models.DateTimeField('Eingereicht am', null=True, blank=True)
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_workorders',
        verbose_name='Eingereicht von'
    )
    reviewed_at = models.DateTimeField('Abgerechnet am', null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_workorders',
        verbose_name='Abgerechnet von'
    )
    
    # Duplikat-Erkennung & Download-Tracking
    content_hash = models.CharField('Inhalts-Hash', max_length=64, blank=True, db_index=True,
                                   help_text='MD5-Hash aus O-Nr, P-Nr, Zeitraum, Beschreibung für Duplikat-Erkennung')
    is_duplicate = models.BooleanField('Ist Duplikat', default=False, 
                                       help_text='Markiert wenn dieser Arbeitsschein bereits existiert')
    duplicate_of = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='duplicates',
        verbose_name='Duplikat von',
        help_text='Referenz zum Original-Arbeitsschein'
    )
    duplicate_checked_at = models.DateTimeField('Duplikat-Check am', null=True, blank=True)
    
    # ❗ NEU: Stornierung
    is_cancelled = models.BooleanField('Storniert', default=False, db_index=True)
    cancellation_reason = models.TextField('Stornierungsgrund', blank=True, null=True)
    cancelled_at = models.DateTimeField('Storniert am', null=True, blank=True)
    cancelled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_workorders',
        verbose_name='Storniert von'
    )
    
    pdf_downloaded = models.BooleanField('PDF heruntergeladen', default=False)
    pdf_downloaded_at = models.DateTimeField('PDF heruntergeladen am', null=True, blank=True)
    pdf_downloaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='downloaded_workorders',
        verbose_name='PDF heruntergeladen von'
    )
    
    # Unterschriften & Versand
    signature_token = models.CharField('Unterschrifts-Token', max_length=100, blank=True, unique=True,
                                       help_text='Eindeutiger Token für digitale Unterschrift-Links')
    signature_link_sent_at = models.DateTimeField('Link gesendet am', null=True, blank=True)
    customer_signature = models.TextField('Unterschrift Kunde', blank=True,
                                          help_text='Base64 encoded signature image')
    customer_signed_at = models.DateTimeField('Unterschrieben am', null=True, blank=True)
    signature_method = models.CharField('Unterschriftsmethode', max_length=20, 
                                       choices=[('digital', 'Digital'), ('physical', 'Physisch'), ('upload', 'Foto-Upload')],
                                       blank=True)
    company_signature = models.TextField('Unterschrift Bogdol', blank=True,
                                         help_text='Base64 encoded signature image')
    scanned_document = models.FileField('Gescannter Arbeitsschein (PDF/Bild)', 
                                         upload_to='workorders/scans/', null=True, blank=True)
    
    # Bemerkungen
    customer_notes = models.TextField('Bemerkung Kunde', blank=True)
    internal_notes = models.TextField('Interne Notizen', blank=True)
    
    # Zeitstempel
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField('Abgeschlossen am', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Arbeitsschein'
        verbose_name_plural = 'Arbeitsscheine'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['client', 'start_date']),
            models.Index(fields=['status']),
            models.Index(fields=['is_cancelled', '-created_at']),  # NEU
        ]
        permissions = [
            ("cancel_workorder", "Can cancel workorder"),
            ("view_all_workorders", "Can view all workorders (toggle)"),
        ]
    
    def __str__(self):
        client_name = self.client.name if self.client else "Kein Kunde"
        return f"{self.order_number} - {client_name}"
    
    def clean(self):
        """Validiere WorkOrder-Daten"""
        from django.core.exceptions import ValidationError
        
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValidationError('Startdatum muss vor dem Enddatum liegen.')
        
        if self.work_days and self.work_days <= 0:
            raise ValidationError('Arbeitstage müssen größer als 0 sein.')
    
    def save(self, *args, **kwargs):
        # Auto-generate order number if not set
        if not self.order_number:
            self.order_number = self.generate_order_number()
        
        # Generate signature token if not exists
        if not self.signature_token:
            import uuid
            self.signature_token = str(uuid.uuid4())
        
        # Auto-set month from start_date
        if self.start_date and not self.month:
            month_names = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
            self.month = f"{month_names[self.start_date.month - 1]} {str(self.start_date.year)[2:]}"
        
        # Set completed_at when status changes to completed/signed
        if self.status in ['completed', 'signed'] and not self.completed_at:
            self.completed_at = timezone.now()
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_order_number():
        """Generate unique order number"""
        from django.utils import timezone
        year = timezone.now().year
        
        # Optimiert: Verwende nur count() statt die letzte Order zu holen
        count = WorkOrder.objects.filter(
            order_number__startswith=f'AS-{year}'
        ).count() + 1
        
        return f'AS-{year}-{count:04d}'
    
    def get_signature_url(self, request=None):
        """Get public URL for customer signature"""
        from django.urls import reverse
        path = reverse('workorder-public-sign', kwargs={'token': self.signature_token})
        if request:
            return request.build_absolute_uri(path)
        return path
    
    def get_qr_code_data(self):
        """Generate QR code data for physical document scanning"""
        import json
        return json.dumps({
            'order_number': self.order_number,
            'token': self.signature_token,
            'type': 'workorder'
        })
    
    def sign_by_customer(self, signature_data, method='digital'):
        """Mark as signed by customer"""
        self.customer_signature = signature_data
        self.customer_signed_at = timezone.now()
        self.signature_method = method
        self.status = 'signed'
        self.save()
    
    def send_signature_link(self):
        """Send signature link to customer via email"""
        from django.core.mail import send_mail
        from django.conf import settings
        
        if not self.client.email:
            raise ValueError('Kunde hat keine E-Mail-Adresse')
        
        signature_url = self.get_signature_url()
        
        subject = f'Arbeitsschein {self.order_number} - Unterschrift erforderlich'
        message = f"""
Sehr geehrte Damen und Herren,

bitte bestätigen Sie den Arbeitsschein {self.order_number} mit Ihrer digitalen Unterschrift:

{signature_url}

Mit freundlichen Grüßen
Ihr Bogdol-Team
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [self.client.email],
            fail_silently=False,
        )
        
        self.signature_link_sent_at = timezone.now()
        self.save()
    
    def get_responsible_billing_user(self):
        """
        Ermittelt den zuständigen Faktura-Mitarbeiter.
        Berücksichtigt automatisch Vertretung bei Abwesenheit.
        """
        if not self.submitted_by:
            return None
        
        # Hole zugewiesenen Faktura-Mitarbeiter aus FakturaAssignment
        from auth_user.profile_models import FakturaAssignment
        
        assignment = FakturaAssignment.objects.filter(
            employee=self.submitted_by,
            is_active=True
        ).select_related('faktura_processor').first()
        
        if not assignment:
            return None
        
        billing_user = assignment.faktura_processor
        
        # Prüfe ob der Faktura-Mitarbeiter aktuell abwesend ist
        from absences.models import Absence
        from django.utils import timezone
        today = timezone.now().date()
        
        active_absence = Absence.objects.filter(
            user=billing_user,
            start_date__lte=today,
            end_date__gte=today,
            status='approved'
        ).select_related('representative').first()
        
        # Falls abwesend UND Vertretung vorhanden → Vertretung zurückgeben
        if active_absence and active_absence.representative:
            return active_absence.representative
        
        # Sonst den normalen zuständigen Mitarbeiter
        return billing_user
    
    def can_mark_billed(self, user):
        """
        Prüft ob ein User den Arbeitsschein als abgerechnet markieren darf.
        Erlaubt: Zugewiesener Faktura-Mitarbeiter ODER Vertretung ODER Admin/Superuser
        """
        if not user:
            return False
        
        # Admin/Superuser darf immer
        if user.is_staff or user.is_superuser:
            return True
        
        responsible = self.get_responsible_billing_user()
        if not responsible:
            return False
        
        # Zugewiesener oder Vertretung
        return user.id == responsible.id
    
    def can_cancel(self, user):
        """
        Prüft ob ein User den Arbeitsschein stornieren darf.
        Verwendet Permission-System mit Scope-Logik.
        """
        if not user:
            return False
        
        # Admin/Superuser darf immer
        if user.is_staff or user.is_superuser:
            return True
        
        # Nutze Permission-Service mit Scope
        from auth_user.permission_service import PermissionService
        
        perm_service = PermissionService.for_user(user)
        
        # Hat der User überhaupt die Permission?
        if not perm_service.has_permission('can_cancel_workorder'):
            return False
        
        # Scope-basierte Prüfung
        scope = perm_service.get_permission_scope('can_cancel_workorder')
        
        if scope == 'ALL':
            return True
        elif scope == 'DEPARTMENT':
            # Prüfe ob Arbeitsschein zur Abteilung des Users gehört
            user_dept_ids = user.user_departments.values_list('department_id', flat=True)
            if self.department_id and self.department_id in user_dept_ids:
                return True
            # Prüfe auch FakturaAssignment
            from auth_user.profile_models import FakturaAssignment
            if FakturaAssignment.objects.filter(
                faktura_processor=user,
                service_manager=self.created_by,
                is_active=True
            ).exists():
                return True
        elif scope == 'OWN':
            # Nur eigene Arbeitsscheine
            if self.created_by and user.id == self.created_by.id:
                return True
            # Prüfe auch FakturaAssignment (zugewiesene Service-Manager)
            from auth_user.profile_models import FakturaAssignment
            if FakturaAssignment.objects.filter(
                faktura_processor=user,
                employee=self.created_by,
                is_active=True
            ).exists():
                return True
        
        return False
    
    def cancel_order(self, user, reason=None):
        """
        Storniert den Arbeitsschein
        
        Args:
            user: User der storniert
            reason: Stornierungsgrund (optional, aber empfohlen)
        
        Raises:
            PermissionError: Wenn User keine Berechtigung hat
            ValueError: Wenn bereits storniert oder PDF heruntergeladen
        """
        # Check: Berechtigung
        if not self.can_cancel(user):
            raise PermissionError('Nur der Ersteller kann den Arbeitsschein stornieren')
        
        # Check: Bereits storniert?
        if self.is_cancelled:
            raise ValueError('Arbeitsschein ist bereits storniert')
        
        # Check: PDF bereits heruntergeladen? (nicht stornierbar)
        if self.pdf_downloaded:
            raise ValueError('Arbeitsschein kann nicht storniert werden - PDF wurde bereits heruntergeladen')
        
        # Stornierung durchführen
        self.is_cancelled = True
        self.cancellation_reason = reason or 'Keine Begründung angegeben'
        self.cancelled_at = timezone.now()
        self.cancelled_by = user
        
        # Legacy status setzen (für Kompatibilität)
        self.status = 'cancelled'
        
        self.save()
        
        # History-Eintrag erstellen
        from .history_models import WorkOrderHistory
        WorkOrderHistory.objects.create(
            work_order=self,
            performed_by=user,
            action='cancelled',
            notes=f'Storniert: {reason or "Keine Begründung"}'
        )
    
    def mark_as_billed(self, user):
        """Markiert Arbeitsschein als abgerechnet"""
        if not self.can_mark_billed(user):
            raise PermissionError('Keine Berechtigung zum Abrechnen')
        
        self.status = 'billed'
        self.reviewed_at = timezone.now()
        self.reviewed_by = user
        self.save()
        
        # History-Eintrag erstellen
        from .history_models import WorkOrderHistory
        WorkOrderHistory.objects.create(
            work_order=self,
            performed_by=user,
            action='billed',
            old_status='submitted',
            new_status='billed',
            notes=f'Als abgerechnet markiert durch {user.get_full_name()}'
        )
    
    def check_for_duplicates(self):
        """
        Prüft ob ein Arbeitsschein mit gleichen Parametern bereits existiert.
        Berücksichtigt auch abgeschlossene/abgerechnete Scheine.
        """
        if not self.object_number or not self.project_number or not self.start_date:
            return []
        
        # Suche nach Duplikaten mit gleichen Kerndaten
        duplicates = WorkOrder.objects.filter(
            object_number=self.object_number,
            project_number=self.project_number,
            start_date=self.start_date,
            end_date=self.end_date
        ).exclude(id=self.id)  # Nicht sich selbst
        
        # Markiere als Duplikat wenn welche gefunden wurden
        if duplicates.exists():
            original = duplicates.order_by('created_at').first()
            self.is_duplicate = True
            self.duplicate_of = original
            self.duplicate_checked_at = timezone.now()
            self.save(update_fields=['is_duplicate', 'duplicate_of', 'duplicate_checked_at'])
        
        return list(duplicates)
    
    def get_optimized_filename(self, extension='pdf'):
        """
        Generiert optimierten Dateinamen: O-Nr_P-Nr_Datum.extension
        z.B. "O-123_P-456_2026-01-05.pdf"
        """
        o_nr = self.object_number or 'OHNE-O-NR'
        p_nr = self.project_number or 'OHNE-P-NR'
        date = self.start_date.strftime('%Y-%m-%d') if self.start_date else 'OHNE-DATUM'
        
        # Bereinige Dateinamen von ungültigen Zeichen
        import re
        o_nr = re.sub(r'[^\w\-]', '', o_nr)
        p_nr = re.sub(r'[^\w\-]', '', p_nr)
        
        return f"{o_nr}_{p_nr}_{date}.{extension}"
    
    def mark_pdf_downloaded(self, user):
        """Markiert PDF als heruntergeladen"""
        self.pdf_downloaded = True
        self.pdf_downloaded_at = timezone.now()
        self.pdf_downloaded_by = user
        self.save(update_fields=['pdf_downloaded', 'pdf_downloaded_at', 'pdf_downloaded_by'])
    
    def match_checklist_item(self):
        """
        Versucht den Arbeitsschein mit einem Haklisten-Eintrag abzugleichen.
        Gibt den passenden Eintrag zurück oder None.
        """
        if not self.object_number or not self.project_number:
            return None
        
        try:
            checklist_item = RecurringWorkOrderChecklist.objects.get(
                object_number=self.object_number,
                project_number=self.project_number,
                is_active=True
            )
            return checklist_item
        except RecurringWorkOrderChecklist.DoesNotExist:
            return None
        except RecurringWorkOrderChecklist.MultipleObjectsReturned:
            # Falls mehrere gefunden: Nimm den neuesten
            return RecurringWorkOrderChecklist.objects.filter(
                object_number=self.object_number,
                project_number=self.project_number,
                is_active=True
            ).order_by('-created_at').first()


class RecurringWorkOrderChecklist(models.Model):
    """
    Hakliste für wiederkehrende Arbeitsscheine.
    Nur für Faktur-Mitarbeiter zur Pflege der Stammdaten.
    """
    # Stammdaten
    object_number = models.CharField('O-Nummer', max_length=50, db_index=True,
                                    help_text='Objektnummer')
    object_description = models.CharField('Objektbeschreibung', max_length=300)
    project_number = models.CharField('P-Nummer', max_length=50, db_index=True,
                                     help_text='Projektnummer')
    debitor_number = models.CharField('Debitor-Nr', max_length=50, blank=True,
                                     help_text='Debitorennummer für Fakturierung')
    
    # SR-Rechnungen (eigenes Feld statt notes)
    sr_invoice_number = models.CharField('SR-Rechnungsnummer', max_length=50, blank=True, db_index=True,
                                        help_text='Sammelrechnungs-Nummer für gruppierte Abrechnung (z.B. SR-2025-01)')
    notes = models.TextField('Bemerkung', blank=True,
                            help_text='Freie Notizen und Hinweise')
    
    # Verknüpfung zu Kunde/Objekt
    client = models.ForeignKey(
        WorkOrderClient,
        on_delete=models.CASCADE,
        related_name='checklist_items',
        verbose_name='Kunde',
        null=True,
        blank=True
    )
    work_object = models.ForeignKey(
        WorkObject,
        on_delete=models.CASCADE,
        related_name='checklist_items',
        verbose_name='Objekt',
        null=True,
        blank=True
    )
    
    # Zuständigkeiten
    service_manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_checklist_items',
        verbose_name='Service Manager',
        help_text='Verantwortlicher Service Manager für diesen wiederkehrenden Auftrag'
    )
    assigned_billing_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_checklist_items',
        verbose_name='Zugewiesener Faktur-Mitarbeiter',
        help_text='Faktur-Mitarbeiter der für die Abrechnung zuständig ist'
    )
    
    # Monatliches Tracking
    current_month = models.CharField('Aktueller Monat', max_length=20, blank=True,
                                    help_text='Format: YYYY-MM')
    checked_this_month = models.BooleanField('Diesen Monat abgehakt', default=False)
    last_checked_at = models.DateTimeField('Zuletzt abgehakt am', null=True, blank=True)
    last_checked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='checked_checklist_items',
        verbose_name='Zuletzt abgehakt von'
    )
    
    # Metadaten
    is_active = models.BooleanField('Aktiv', default=True)
    valid_from = models.DateField('Gültig von', null=True, blank=True,
                                   help_text='Ab wann soll dieser Eintrag in der monatlichen Hakliste erscheinen')
    valid_until = models.DateField('Gültig bis', null=True, blank=True,
                                    help_text='Bis wann soll dieser Eintrag in der monatlichen Hakliste erscheinen')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_checklist_items',
        verbose_name='Erstellt von'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Hakliste-Eintrag'
        verbose_name_plural = 'Hakliste'
        ordering = ['object_number', 'project_number']
        indexes = [
            models.Index(fields=['object_number', 'project_number']),
            models.Index(fields=['sr_invoice_number']),
            models.Index(fields=['current_month']),
            models.Index(fields=['service_manager']),
            models.Index(fields=['assigned_billing_user']),
        ]
        unique_together = [['object_number', 'project_number']]
    
    def __str__(self):
        return f"{self.object_number} - {self.project_number} - {self.object_description}"
    
    def save(self, *args, **kwargs):
        # Setze aktuellen Monat wenn nicht gesetzt
        if not self.current_month:
            from django.utils import timezone
            self.current_month = timezone.now().strftime('%Y-%m')
        
        super().save(*args, **kwargs)
    
    def reset_monthly_check(self):
        """Setzt die monatliche Prüfung zurück (wird monatlich automatisch aufgerufen)"""
        from django.utils import timezone
        current = timezone.now().strftime('%Y-%m')
        
        if self.current_month != current:
            self.current_month = current
            self.checked_this_month = False
            self.save()
    
    def check_for_month(self, user):
        """Hakt den Eintrag für den aktuellen Monat ab"""
        from django.utils import timezone
        self.reset_monthly_check()  # Stellt sicher dass der Monat aktuell ist
        
        self.checked_this_month = True
        self.last_checked_at = timezone.now()
        self.last_checked_by = user
        self.save()
    
    @classmethod
    def get_items_for_sr_number(cls, sr_number, month=None):
        """Gibt alle Haklisten-Einträge für eine SR-Nummer zurück"""
        from django.utils import timezone
        if not month:
            month = timezone.now().strftime('%Y-%m')
        
        return cls.objects.filter(
            sr_number=sr_number,
            is_active=True,
            current_month=month
        )
