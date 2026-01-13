"""
Signals für automatische Feiertags-Verwaltung und Chat-Integration
"""
from django.db.models.signals import post_save, post_migrate
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils import timezone
from absences.models import AbsenceType, Absence
from datetime import date, datetime
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


def get_german_holidays(year):
    """
    Berechnet deutsche Feiertage für Hamburg
    Returns: List of (date, name) tuples
    """
    holidays = []
    
    # Feste Feiertage
    holidays.append((date(year, 1, 1), 'Neujahr'))
    holidays.append((date(year, 5, 1), 'Tag der Arbeit'))
    holidays.append((date(year, 10, 3), 'Tag der Deutschen Einheit'))
    holidays.append((date(year, 10, 31), 'Reformationstag'))
    holidays.append((date(year, 12, 25), '1. Weihnachtstag'))
    holidays.append((date(year, 12, 26), '2. Weihnachtstag'))
    
    # Bewegliche Feiertage (basierend auf Ostern)
    easter = calculate_easter(year)
    
    # Karfreitag (2 Tage vor Ostern)
    from datetime import timedelta
    good_friday = easter - timedelta(days=2)
    holidays.append((good_friday, 'Karfreitag'))
    
    # Ostermontag (1 Tag nach Ostern)
    easter_monday = easter + timedelta(days=1)
    holidays.append((easter_monday, 'Ostermontag'))
    
    # Christi Himmelfahrt (39 Tage nach Ostern)
    ascension = easter + timedelta(days=39)
    holidays.append((ascension, 'Christi Himmelfahrt'))
    
    # Pfingstmontag (50 Tage nach Ostern)
    whit_monday = easter + timedelta(days=50)
    holidays.append((whit_monday, 'Pfingstmontag'))
    
    return sorted(holidays)


def calculate_easter(year):
    """Berechnet Ostersonntag nach Gauß'scher Osterformel"""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    
    return date(year, month, day)


def ensure_public_holiday_type():
    """Stellt sicher, dass der PUBLIC_HOLIDAY AbsenceType existiert"""
    public_holiday_type, created = AbsenceType.objects.get_or_create(
        name=AbsenceType.PUBLIC_HOLIDAY,
        defaults={
            'display_name': 'Feiertag',
            'description': 'Gesetzlicher Feiertag (Hamburg)',
            'requires_approval': False,
            'requires_certificate': False,
            'advance_notice_days': 0,
            'color': '#6c757d',
            'is_active': True,
        }
    )
    return public_holiday_type


def create_holidays_for_user(user, years=None):
    """
    Erstellt Feiertage für einen bestimmten Benutzer
    
    Args:
        user: User-Objekt
        years: Liste von Jahren (default: aktuelles Jahr ± 5 Jahre)
    """
    if not user.is_active:
        return
    
    if years is None:
        current_year = timezone.now().year
        # Erstelle Feiertage für aktuelles Jahr ± 5 Jahre
        years = list(range(current_year - 5, current_year + 6))
    
    public_holiday_type = ensure_public_holiday_type()
    created_count = 0
    
    for year in years:
        holidays = get_german_holidays(year)
        
        for holiday_date, holiday_name in holidays:
            # Prüfe ob Abwesenheit bereits existiert
            _, created = Absence.objects.get_or_create(
                user=user,
                absence_type=public_holiday_type,
                start_date=holiday_date,
                end_date=holiday_date,
                defaults={
                    'status': Absence.APPROVED,
                    'reason': holiday_name,
                    'manual_duration_days': 0,
                    'hr_notified': True,
                    'representative_confirmed': True,
                }
            )
            if created:
                created_count += 1
    
    return created_count


@receiver(post_save, sender=User)
def create_holidays_for_new_user(sender, instance, created, **kwargs):
    """
    Signal: Erstellt automatisch Feiertage für neu angelegte Benutzer
    """
    if created and instance.is_active:
        # Erstelle Feiertage für aktuelles und nächstes Jahr
        create_holidays_for_user(instance)
        print(f"✓ Feiertage für Benutzer {instance.username} erstellt")


@receiver(post_migrate)
def ensure_all_users_have_holidays(sender, **kwargs):
    """
    Signal: Stellt sicher, dass alle aktiven Benutzer Feiertage haben
    Wird nach jeder Migration ausgeführt
    """
    # Nur für die absences app ausführen
    if sender.name != 'absences':
        return
    
    ensure_public_holiday_type()
    
    current_year = timezone.now().year
    # Erstelle Feiertage für aktuelles Jahr ± 5 Jahre
    years = list(range(current_year - 5, current_year + 6))
    
    # Hole alle aktiven Benutzer
    users = User.objects.filter(is_active=True)
    
    total_created = 0
    for user in users:
        created = create_holidays_for_user(user, years=years)
        total_created += created
    
    if total_created > 0:
        print(f"✓ {total_created} Feiertags-Einträge für {users.count()} Benutzer erstellt/aktualisiert")


@receiver(post_save, sender=Absence)
def handle_absence_chat_integration(sender, instance, created, **kwargs):
    """
    Signal: Chat-Integration für Abwesenheitsanträge
    - Bei Erstellung: Chat mit Vorgesetztem erstellen und Antragsnachricht senden
    - Nur für Anträge die Genehmigung benötigen
    """
    # Nur für neu erstellte Anträge die Genehmigung benötigen
    if not created:
        return
    
    if not instance.absence_type.requires_approval:
        logger.info(f"Absence {instance.id}: Keine Genehmigung erforderlich, überspringe Chat-Integration")
        return
    
    if instance.status != Absence.PENDING:
        logger.info(f"Absence {instance.id}: Status ist nicht PENDING, überspringe Chat-Integration")
        return
    
    try:
        from absences.chat_helpers import (
            get_or_create_direct_conversation,
            get_first_admin_or_hr,
            send_absence_request_message
        )
        
        # Vorgesetzten ermitteln (oder Fallback zu Admin/HR)
        supervisor = None
        if hasattr(instance.user, 'userprofile') and instance.user.userprofile.direct_supervisor:
            supervisor = instance.user.userprofile.direct_supervisor
            logger.info(f"Absence {instance.id}: Vorgesetzter gefunden: {supervisor.username}")
        else:
            supervisor = get_first_admin_or_hr()
            logger.info(f"Absence {instance.id}: Kein Vorgesetzter, Fallback zu: {supervisor.username if supervisor else 'None'}")
        
        if not supervisor:
            logger.error(f"Absence {instance.id}: Kein Vorgesetzter oder Admin/HR gefunden!")
            return
        
        # Chat-Konversation erstellen oder finden
        conversation = get_or_create_direct_conversation(instance.user, supervisor)
        logger.info(f"Absence {instance.id}: Konversation {conversation.id} erstellt/gefunden")
        
        # Konversation mit Absence verknüpfen
        instance.conversation = conversation
        instance.save(update_fields=['conversation'])
        logger.info(f"Absence {instance.id}: Mit Konversation {conversation.id} verknüpft")
        
        # Antragsnachricht senden
        message = send_absence_request_message(conversation, instance, instance.user)
        logger.info(f"Absence {instance.id}: Antragsnachricht {message.id} gesendet")
        
    except Exception as e:
        logger.error(f"Fehler bei Chat-Integration für Absence {instance.id}: {str(e)}", exc_info=True)


@receiver(post_save, sender=Absence)
def create_substitute_assignment(sender, instance, created, **kwargs):
    """
    Erstellt automatisch SubstituteAssignment wenn Vertretung gesetzt und genehmigt
    """
    from auth_user.profile_models import SubstituteAssignment
    
    # Nur wenn Vertretung gesetzt und Status approved/hr_processed
    if not instance.representative:
        return
    
    if instance.status not in [Absence.APPROVED, Absence.HR_PROCESSED]:
        return
    
    try:
        # Erstelle oder aktualisiere SubstituteAssignment
        assignment, created = SubstituteAssignment.objects.get_or_create(
            absence=instance,
            original_user=instance.user,
            substitute_user=instance.representative,
            defaults={'is_active': True}
        )
        
        if created:
            logger.info(f"✅ SubstituteAssignment erstellt: {instance.representative.username} vertritt {instance.user.username}")
        else:
            # Reaktiviere falls deaktiviert
            if not assignment.is_active:
                assignment.is_active = True
                assignment.save(update_fields=['is_active'])
                logger.info(f"✅ SubstituteAssignment reaktiviert: {instance.representative.username} vertritt {instance.user.username}")
    
    except Exception as e:
        logger.error(f"Fehler beim Erstellen von SubstituteAssignment für Absence {instance.id}: {str(e)}", exc_info=True)
