from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

class AbsenceType(models.Model):
    """Definiert verschiedene Abwesenheitstypen mit spezifischen Eigenschaften"""
    VACATION = 'vacation'
    SICK_LEAVE = 'sick_leave'
    PERSONAL_LEAVE = 'personal_leave'
    TRAINING = 'training'
    BUSINESS_TRIP = 'business_trip'
    MATERNITY_LEAVE = 'maternity_leave'
    PARENTAL_LEAVE = 'parental_leave'
    UNPAID_LEAVE = 'unpaid_leave'
    PUBLIC_HOLIDAY = 'public_holiday'
    
    TYPE_CHOICES = [
        (VACATION, 'Urlaub'),
        (SICK_LEAVE, 'Krankmeldung'),
        (PERSONAL_LEAVE, 'Persönlicher Grund'),
        (TRAINING, 'Fortbildung'),
        (BUSINESS_TRIP, 'Geschäftsreise'),
        (MATERNITY_LEAVE, 'Mutterschutz'),
        (PARENTAL_LEAVE, 'Elternzeit'),
        (UNPAID_LEAVE, 'Unbezahlter Urlaub'),
        (PUBLIC_HOLIDAY, 'Feiertag'),
    ]
    
    name = models.CharField(max_length=50, choices=TYPE_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    requires_approval = models.BooleanField(default=True)
    requires_certificate = models.BooleanField(default=False)  # z.B. für Krankmeldung
    advance_notice_days = models.PositiveIntegerField(default=0)  # Mindest-Vorlaufzeit
    max_consecutive_days = models.PositiveIntegerField(null=True, blank=True)
    color = models.CharField(max_length=7, default='#007bff', help_text='Hex-Farbe für UI')
    icon = models.CharField(max_length=50, default='calendar-outline', help_text='Ionic Icon Name')
    deduct_from_vacation = models.BooleanField(default=False, help_text='Von Urlaubskonto abziehen')
    # ✅ NEW Phase 2: Urlaubssaldo-Berechnung
    affects_vacation_balance = models.BooleanField(
        default=False,
        help_text='Wirkt sich auf den Urlaubssaldo aus (z.B. Urlaub, Überstunden-Abbau)'
    )
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['display_name']
        verbose_name = 'Abwesenheitstyp'
        verbose_name_plural = 'Abwesenheitstypen'
        indexes = [
            models.Index(fields=['name', 'is_active']),
        ]
    
    def __str__(self):
        return self.display_name


class Absence(models.Model):
    """Erweiterte Abwesenheit mit verbessertem Status-Workflow"""
    
    # Status Choices
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    HR_PROCESSED = 'hr_processed'
    CANCELLED = 'cancelled'
    REVISION_REQUESTED = 'revision_requested'
    
    STATUS_CHOICES = [
        (PENDING, 'Ausstehend'),
        (APPROVED, 'Genehmigt'),
        (REJECTED, 'Abgelehnt'),
        (HR_PROCESSED, 'HR Bearbeitet'),
        (CANCELLED, 'Storniert'),
        (REVISION_REQUESTED, 'Überarbeitung angefordert'),
    ]
    
    # Grunddaten
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='absences')
    absence_type = models.ForeignKey(AbsenceType, on_delete=models.PROTECT, related_name='absences')
    start_date = models.DateField()
    end_date = models.DateField()
    manual_duration_days = models.PositiveIntegerField(
        null=True, 
        blank=True, 
        help_text="Manuell eingegebene Anzahl Arbeitstage (überschreibt automatische Berechnung)"
    )
    reason = models.TextField(blank=True, null=True)
    
    # Status und Workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    
    # Revision/Bearbeitung
    is_revision = models.BooleanField(default=False, help_text="Kennzeichnet eine überarbeitete Version")
    revision_of = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='revisions')
    revision_reason = models.TextField(null=True, blank=True)
    
    # Genehmigung
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='approved_absences'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_comment = models.TextField(null=True, blank=True)
    
    # Ablehnung
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='rejected_absences'
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    
    # Vertretung
    representative = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,  # Optional - z.B. bei Feiertagen
        blank=True,  # Optional - z.B. bei Feiertagen
        on_delete=models.PROTECT,
        related_name='representing_absences',
        verbose_name='Vertretung',
        help_text='Vertretung während der Abwesenheit'
    )
    representative_confirmed = models.BooleanField(default=False)
    representative_confirmed_at = models.DateTimeField(null=True, blank=True)
    
    # HR Integration
    hr_processed = models.BooleanField(default=False, help_text="Von HR als bearbeitet markiert")
    hr_processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='hr_processed_absences'
    )
    hr_processed_at = models.DateTimeField(null=True, blank=True)
    hr_comment = models.TextField(null=True, blank=True)
    
    # Legacy HR field for backward compatibility
    hr_notified = models.BooleanField(default=False)
    hr_notified_at = models.DateTimeField(null=True, blank=True)
    
    # Dateien
    certificate = models.FileField(upload_to='absence_certificates/', null=True, blank=True)
    additional_documents = models.FileField(upload_to='absence_documents/', null=True, blank=True)
    
    # Chat Integration
    conversation = models.ForeignKey(
        'auth_user.ChatConversation',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='absence_requests',
        help_text='Chat-Konversation für Antrag und Genehmigung'
    )
    
    # Änderungsverlauf
    change_history = models.JSONField(
        default=list,
        blank=True,
        help_text='Liste von Änderungen: [{timestamp, user, field, old_value, new_value, reason}]'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Legacy-Feld für Rückwärtskompatibilität
    approved = models.BooleanField(default=False, editable=False)

    class Meta:
        ordering = ['-start_date']
        verbose_name = 'Abwesenheit'
        verbose_name_plural = 'Abwesenheiten'
        indexes = [
            models.Index(fields=['user', 'status', 'start_date']),
            models.Index(fields=['absence_type', 'status']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def clean(self):
        """Validierung der Abwesenheit"""
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValidationError('Startdatum muss vor dem Enddatum liegen.')
            
            # Prüfe Mindest-Vorlaufzeit
            if self.absence_type and self.absence_type.advance_notice_days > 0:
                notice_required = timezone.now().date() + timezone.timedelta(days=self.absence_type.advance_notice_days)
                if self.start_date < notice_required:
                    raise ValidationError(f'Für {self.absence_type.display_name} ist eine Vorlaufzeit von {self.absence_type.advance_notice_days} Tagen erforderlich.')
            
            # Prüfe maximale aufeinanderfolgende Tage
            if self.absence_type and self.absence_type.max_consecutive_days:
                duration = (self.end_date - self.start_date).days + 1
                if duration > self.absence_type.max_consecutive_days:
                    raise ValidationError(f'Maximale Dauer für {self.absence_type.display_name}: {self.absence_type.max_consecutive_days} Tage.')
    
    def save(self, *args, **kwargs):
        # Legacy approved Feld synchronisieren
        self.approved = self.status == self.APPROVED
        super().save(*args, **kwargs)
    
    @property
    def duration_days(self):
        """Gibt die Anzahl der Abwesenheitstage zurück - manuell oder berechnet"""
        # Wenn manuell eingegeben wurde, verwende das
        if self.manual_duration_days is not None:
            return self.manual_duration_days
        
        # Sonst automatische Berechnung (alle Tage)
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0
    
    def get_workday_count(self):
        """Berechnet nur Werktage (Montag-Freitag)"""
        if not self.start_date or not self.end_date:
            return 0
            
        from datetime import date, timedelta
        
        start = self.start_date
        end = self.end_date
        workdays = 0
        
        current_date = start
        while current_date <= end:
            # Montag = 0, Sonntag = 6
            # Montag-Freitag = 0-4
            if current_date.weekday() < 5:  # 0-4 = Mo-Fr
                workdays += 1
            current_date += timedelta(days=1)
            
        return workdays
    
    @property
    def workday_duration(self):
        """Alias für get_workday_count für Templates"""
        return self.get_workday_count()
    
    @property
    def is_pending(self):
        return self.status == self.PENDING
    
    @property
    def is_approved(self):
        return self.status == self.APPROVED
    
    @property
    def is_rejected(self):
        return self.status == self.REJECTED
    
    def approve(self, approved_by, comment=None):
        """Genehmigt die Abwesenheit"""
        self.status = self.APPROVED
        self.approved_by = approved_by
        self.approved_at = timezone.now()
        self.approval_comment = comment
        self.save()
    
    def reject(self, rejected_by, reason):
        """Lehnt die Abwesenheit ab"""
        self.status = self.REJECTED
        self.rejected_by = rejected_by
        self.rejected_at = timezone.now()
        self.rejection_reason = reason
        self.save()
    
    def notify_hr(self, comment=None):
        """Markiert als HR benachrichtigt (Legacy)"""
        self.hr_notified = True
        self.hr_notified_at = timezone.now()
        if comment:
            self.hr_comment = comment
        self.save()
    
    def process_by_hr(self, hr_user, comment=None):
        """Von HR als bearbeitet markieren"""
        self.status = self.HR_PROCESSED
        self.hr_processed = True
        self.hr_processed_by = hr_user
        self.hr_processed_at = timezone.now()
        if comment:
            self.hr_comment = comment
        self.save()
    
    def request_revision(self, by_user, reason):
        """Überarbeitung anfordern"""
        self.status = self.REVISION_REQUESTED
        self.revision_reason = reason
        if hasattr(by_user, 'supervised_users') and by_user.supervised_users.filter(id=self.user.id).exists():
            # Von Vorgesetzten
            self.rejected_by = by_user
            self.rejected_at = timezone.now()
            self.rejection_reason = reason
        self.save()
    
    def create_revision(self, **kwargs):
        """Erstelle eine überarbeitete Version"""
        revision_data = {
            'user': self.user,
            'absence_type': self.absence_type,
            'is_revision': True,
            'revision_of': self,
            'status': self.PENDING,
        }
        revision_data.update(kwargs)
        
        revision = Absence.objects.create(**revision_data)
        return revision
    
    def validate_vacation_entitlement(self):
        """Prüfe Urlaubsanspruch bei Urlaubsanträgen"""
        if self.absence_type.name == AbsenceType.VACATION:
            workdays = self.get_workday_count()
            if not self.user.can_take_vacation(workdays, self.start_date.year):
                remaining = self.user.get_remaining_vacation_days(self.start_date.year)
                raise ValidationError(
                    f'Nicht genügend Urlaubstage verfügbar. '
                    f'Benötigt: {workdays}, Verfügbar: {remaining}'
                )

    def __str__(self):
        return f"{self.user.username} - {self.absence_type.display_name} vom {self.start_date} bis {self.end_date} ({self.get_status_display()})"


class AbsenceConflict(models.Model):
    """Erkennt und verwaltet Abwesenheitskonflikte"""
    
    TEAM_OVERLAP = 'team_overlap'
    REPRESENTATIVE_CONFLICT = 'representative_conflict'
    DEPARTMENT_SHORTAGE = 'department_shortage'
    CRITICAL_PERIOD = 'critical_period'
    
    CONFLICT_TYPES = [
        (TEAM_OVERLAP, 'Team-Überschneidung'),
        (REPRESENTATIVE_CONFLICT, 'Vertretungskonflikt'),
        (DEPARTMENT_SHORTAGE, 'Abteilungs-Engpass'),
        (CRITICAL_PERIOD, 'Kritischer Zeitraum'),
    ]
    
    absence = models.ForeignKey(Absence, on_delete=models.CASCADE, related_name='conflicts')
    conflict_type = models.CharField(max_length=30, choices=CONFLICT_TYPES)
    conflicting_absence = models.ForeignKey(Absence, on_delete=models.CASCADE, related_name='conflicted_by', null=True, blank=True)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=[('low', 'Niedrig'), ('medium', 'Mittel'), ('high', 'Hoch')], default='medium')
    resolved = models.BooleanField(default=False)
    resolution_comment = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Abwesenheitskonflikt'
        verbose_name_plural = 'Abwesenheitskonflikte'
    
    def __str__(self):
        return f"Konflikt: {self.get_conflict_type_display()} - {self.absence}"


class AbsenceComment(models.Model):
    """Kommentare für Kommunikation im Abwesenheitsprozess"""
    
    COMMENT_TYPES = [
        ('user_comment', 'Benutzer Kommentar'),
        ('supervisor_feedback', 'Vorgesetzten Feedback'),
        ('hr_note', 'HR Notiz'),
        ('revision_request', 'Überarbeitungsanfrage'),
        ('approval_note', 'Genehmigungsnotiz'),
        ('rejection_note', 'Ablehnungsnotiz'),
    ]
    
    absence = models.ForeignKey(Absence, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment_type = models.CharField(max_length=20, choices=COMMENT_TYPES, default='user_comment')
    content = models.TextField()
    is_internal = models.BooleanField(default=False, help_text="Nur für HR/Vorgesetzte sichtbar")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Abwesenheits-Kommentar'
        verbose_name_plural = 'Abwesenheits-Kommentare'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.author.get_full_name() or self.author.username}: {self.content[:50]}..."
