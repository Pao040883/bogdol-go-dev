# accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

# Import neue Models
from .profile_models import Department, Team, UserProfile, UserPresence
from .chat_models import ChatConversation, ChatMessage, ChatTypingIndicator

class CustomUser(AbstractUser):
    """
    Custom User Model - NUR für Authentifizierung
    
    Alle Profildaten sind in UserProfile ausgelagert.
    Zugriff über: user.profile.field_name
    """
    
    class Meta:
        verbose_name = 'Benutzer'
        verbose_name_plural = 'Benutzer'
    
    def __str__(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username
    
    # === PROPERTIES ===
    
    @property
    def online_status(self):
        """Gibt Online-Status zurück"""
        if hasattr(self, 'presence'):
            return self.presence.status
        return 'offline'
    
    @property
    def is_online(self):
        """Prüft ob User online ist"""
        return self.online_status == 'online'
    
    @property
    def is_supervisor(self):
        """Prüft ob User Vorgesetzter ist (hat direct_reports)"""
        if hasattr(self, 'profile') and self.profile:
            return self.profile.direct_reports.filter(is_active=True).exists()
        return False
    
    # === VACATION METHODS ===
    
    def get_used_vacation_days(self, year=None):
        """Berechne verwendete Urlaubstage für ein Jahr"""
        from absences.models import Absence, AbsenceType
        from django.db.models import Q
        from django.utils import timezone
        
        if year is None:
            year = timezone.now().year
            
        try:
            vacation_type = AbsenceType.objects.get(name=AbsenceType.VACATION)
        except AbsenceType.DoesNotExist:
            return 0
            
        # Berücksichtige Urlaube, die über Jahresgrenzen gehen
        used_absences = self.absences.select_related('absence_type').filter(
            absence_type=vacation_type,
            status__in=[Absence.APPROVED, Absence.HR_PROCESSED],
        ).filter(
            Q(start_date__year=year) | Q(end_date__year=year)
        )
        
        total_days = sum(absence.get_workday_count() for absence in used_absences)
        return total_days
    
    def get_remaining_vacation_days(self, year=None):
        """Berechne verbleibende Urlaubstage"""
        from django.utils import timezone
        
        if year is None:
            year = timezone.now().year
        
        if not hasattr(self, 'profile') or not self.profile:
            return 0
            
        # Nutze Profile-Daten
        vacation_ent = self.profile.vacation_entitlement
        carryover = self.profile.carryover_vacation
        vacation_yr = self.profile.vacation_year
        
        total_entitlement = vacation_ent
        if year == vacation_yr:
            total_entitlement += carryover
            
        used_days = self.get_used_vacation_days(year)
        return max(0, total_entitlement - used_days)
    
    def can_take_vacation(self, days, year=None):
        """Prüfe ob Urlaubstage verfügbar sind"""
        remaining = self.get_remaining_vacation_days(year)
        return remaining >= days
