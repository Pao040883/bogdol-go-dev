from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

@shared_task
def send_absence_notification(absence_id, notification_type):
    """
    Sendet Abwesenheits-Benachrichtigungen
    """
    try:
        from .models import Absence
        absence = Absence.objects.get(id=absence_id)
        
        if notification_type == 'approval_request':
            subject = f"Abwesenheitsantrag: {absence.user.get_full_name()}"
            message = f"""
            Neuer Abwesenheitsantrag:
            
            Mitarbeiter: {absence.user.get_full_name()}
            Zeitraum: {absence.start_date} bis {absence.end_date}
            Typ: {absence.absence_type.name if absence.absence_type else 'Standard'}
            Grund: {absence.reason or 'Nicht angegeben'}
            
            Bitte prüfen Sie den Antrag im System.
            """
            
            # An Supervisor senden
            recipients = []
            if hasattr(absence.user, 'profile') and absence.user.profile.direct_supervisor:
                recipients.append(absence.user.profile.direct_supervisor.email)
            
            # Fallback: An HR senden
            if not recipients:
                recipients = [settings.HR_EMAIL] if hasattr(settings, 'HR_EMAIL') else ['hr@bogdol.gmbh']
            
        elif notification_type == 'approved':
            subject = f"Abwesenheit genehmigt: {absence.start_date} - {absence.end_date}"
            message = f"""
            Ihre Abwesenheit wurde genehmigt:
            
            Zeitraum: {absence.start_date} bis {absence.end_date}
            Status: Genehmigt
            
            Weitere Details finden Sie im System.
            """
            recipients = [absence.user.email] if absence.user.email else []
            
        elif notification_type == 'rejected':
            subject = f"Abwesenheit abgelehnt: {absence.start_date} - {absence.end_date}"
            message = f"""
            Ihre Abwesenheit wurde leider abgelehnt:
            
            Zeitraum: {absence.start_date} bis {absence.end_date}
            Status: Abgelehnt
            Grund: {absence.rejection_reason or 'Nicht angegeben'}
            
            Bitte wenden Sie sich bei Fragen an Ihren Vorgesetzten.
            """
            recipients = [absence.user.email] if absence.user.email else []
            
        elif notification_type == 'hr_notification':
            subject = f"HR-Benachrichtigung: Genehmigte Abwesenheit"
            message = f"""
            Eine Abwesenheit wurde genehmigt:
            
            Mitarbeiter: {absence.user.get_full_name()}
            Zeitraum: {absence.start_date} bis {absence.end_date}
            Genehmigt von: {absence.approved_by.get_full_name() if absence.approved_by else 'System'}
            
            Bitte für Personalplanung berücksichtigen.
            """
            recipients = [settings.HR_EMAIL] if hasattr(settings, 'HR_EMAIL') else ['hr@bogdol.gmbh']
            
        else:
            logger.warning(f"Unknown notification type: {notification_type}")
            return {'status': 'error', 'message': 'Unknown notification type'}
            
        # Email senden
        if recipients:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=False
            )
            
            logger.info(f"✅ Notification sent: {notification_type} for absence {absence_id}")
            return {'status': 'sent', 'recipients': recipients, 'type': notification_type}
        else:
            logger.warning(f"No recipients for notification {notification_type}")
            return {'status': 'no_recipients'}
            
    except Exception as exc:
        logger.error(f"❌ Notification failed: {exc}")
        raise

@shared_task
def send_absence_reminders():
    """
    Sendet Erinnerungen für ausstehende Genehmigungen
    """
    try:
        from .models import Absence
        
        # Finde Abwesenheiten die seit 24h ungenehmigt sind
        cutoff = timezone.now() - timedelta(hours=24)
        pending_absences = Absence.objects.filter(
            status='PENDING',
            created_at__lt=cutoff
        )
        
        reminders_sent = 0
        
        for absence in pending_absences:
            try:
                send_absence_notification.delay(absence.id, 'approval_request')
                reminders_sent += 1
            except Exception as e:
                logger.error(f"Failed to send reminder for absence {absence.id}: {e}")
                continue
        
        logger.info(f"✅ Sent {reminders_sent} absence reminders")
        return {'reminders_sent': reminders_sent}
        
    except Exception as exc:
        logger.error(f"❌ Absence reminders failed: {exc}")
        raise

@shared_task
def check_upcoming_absences():
    """
    Prüft kommende Abwesenheiten und sendet Erinnerungen
    """
    try:
        from .models import Absence
        
        # Abwesenheiten die in den nächsten 3 Tagen beginnen
        start_date = timezone.now().date()
        end_date = start_date + timedelta(days=3)
        
        upcoming_absences = Absence.objects.filter(
            status='APPROVED',
            start_date__range=[start_date, end_date],
            reminder_sent=False
        )
        
        notifications_sent = 0
        
        for absence in upcoming_absences:
            try:
                # An HR senden
                subject = f"Kommende Abwesenheit: {absence.user.get_full_name()}"
                message = f"""
                Erinnerung: Kommende Abwesenheit
                
                Mitarbeiter: {absence.user.get_full_name()}
                Beginn: {absence.start_date}
                Ende: {absence.end_date}
                Typ: {absence.absence_type.name if absence.absence_type else 'Standard'}
                
                Bitte für Personalplanung berücksichtigen.
                """
                
                hr_email = getattr(settings, 'HR_EMAIL', 'hr@bogdol.gmbh')
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[hr_email],
                    fail_silently=True
                )
                
                # Markieren als gesendet
                absence.reminder_sent = True
                absence.save(update_fields=['reminder_sent'])
                
                notifications_sent += 1
                
            except Exception as e:
                logger.error(f"Failed to send upcoming absence notification for {absence.id}: {e}")
                continue
        
        logger.info(f"✅ Sent {notifications_sent} upcoming absence notifications")
        return {'notifications_sent': notifications_sent}
        
    except Exception as exc:
        logger.error(f"❌ Upcoming absence check failed: {exc}")
        raise

@shared_task
def cleanup_old_absences():
    """
    Bereinigt alte Abwesenheitsdaten (älter als 2 Jahre)
    """
    try:
        from .models import Absence
        
        cutoff_date = timezone.now().date() - timedelta(days=730)  # 2 Jahre
        
        old_absences = Absence.objects.filter(
            end_date__lt=cutoff_date,
            status__in=['APPROVED', 'REJECTED']
        )
        
        count = old_absences.count()
        old_absences.delete()
        
        logger.info(f"✅ Cleaned up {count} old absences")
        return {'cleaned_absences': count}
        
    except Exception as exc:
        logger.error(f"❌ Absence cleanup failed: {exc}")
        raise


@shared_task
def create_public_holidays_for_year(year=None):
    """
    Erstellt automatisch Feiertage für alle aktiven Benutzer für ein bestimmtes Jahr
    Läuft automatisch am Jahresanfang
    """
    from django.contrib.auth import get_user_model
    from .signals import create_holidays_for_user, ensure_public_holiday_type
    
    User = get_user_model()
    
    if year is None:
        year = timezone.now().year
    
    try:
        ensure_public_holiday_type()
        
        users = User.objects.filter(is_active=True)
        total_created = 0
        
        for user in users:
            created = create_holidays_for_user(user, years=[year])
            total_created += created
        
        logger.info(f"✅ Created {total_created} public holiday entries for {users.count()} users for year {year}")
        return {
            'year': year,
            'users': users.count(),
            'created_entries': total_created
        }
        
    except Exception as exc:
        logger.error(f"❌ Public holiday creation failed: {exc}")
        raise


@shared_task
def ensure_next_year_holidays():
    """
    Stellt sicher, dass Feiertage für das nächste Jahr existieren
    Läuft automatisch täglich, erstellt aber nur im Dezember Feiertage fürs Folgejahr
    """
    current_month = timezone.now().month
    
    # Nur im Dezember ausführen
    if current_month != 12:
        logger.info("⏭️  Skipping next year holiday creation (not December)")
        return {'skipped': True, 'reason': 'Not December'}
    
    next_year = timezone.now().year + 1
    logger.info(f"🎄 Creating holidays for next year ({next_year}) - December detected")
    return create_public_holidays_for_year(next_year)


@shared_task
def calculate_carryover_vacation():
    """
    🆕 Phase 2: Berechnet Resturlaub zum Jahresende (31.12.)
    
    Läuft automatisch täglich, aber führt nur am 31. Dezember aus
    
    Logik:
    1. Für jeden aktiven User:
       - Aktuelles vacation_entitlement (z.B. 30 Tage)
       - Genommene Urlaubstage im aktuellen Jahr (affects_vacation_balance=True)
       - Resturlaub = vacation_entitlement - genommene_tage
    2. Übertrag ins nächste Jahr (max. gesetzliche Grenze, z.B. 20 Tage)
    3. UserProfile.carryover_vacation aktualisieren
    4. UserProfile.vacation_year auf nächstes Jahr setzen
    """
    from django.contrib.auth import get_user_model
    from auth_user.models import UserProfile
    from .models import Absence, AbsenceType
    from django.db.models import Q, Sum
    from datetime import date
    
    User = get_user_model()
    today = timezone.now().date()
    
    # Nur am 31. Dezember ausführen
    if today.month != 12 or today.day != 31:
        logger.info(f"⏭️  Skipping carryover calculation (today is {today}, not December 31st)")
        return {'skipped': True, 'reason': 'Not December 31st', 'date': str(today)}
    
    current_year = today.year
    next_year = current_year + 1
    
    # Maximaler Übertrag (gesetzliche Regelung)
    MAX_CARRYOVER = 20
    
    try:
        users = User.objects.filter(is_active=True).select_related('profile')
        results = {
            'processed': 0,
            'errors': [],
            'details': []
        }
        
        for user in users:
            try:
                profile = getattr(user, 'profile', None)
                if not profile:
                    logger.warning(f"⚠️  User {user.username} hat kein Profil - überspringe")
                    continue
                
                # Jahresurlaubsanspruch
                vacation_entitlement = profile.vacation_entitlement or 30
                
                # Genommene Urlaubstage im aktuellen Jahr
                # Nur genehmigte Abwesenheiten mit affects_vacation_balance=True
                taken_vacation_days = Absence.objects.filter(
                    user=user,
                    start_date__year=current_year,
                    status='approved',
                    absence_type__affects_vacation_balance=True
                ).aggregate(
                    total_days=Sum(
                        models.F('end_date') - models.F('start_date') + timedelta(days=1)
                    )
                )['total_days'] or 0
                
                # Resturlaub berechnen
                remaining_vacation = vacation_entitlement - taken_vacation_days
                
                # Übertrag berechnen (max. MAX_CARRYOVER)
                carryover = max(0, min(remaining_vacation, MAX_CARRYOVER))
                
                # UserProfile aktualisieren
                old_carryover = profile.carryover_vacation
                profile.carryover_vacation = carryover
                profile.vacation_year = next_year
                profile.save(update_fields=['carryover_vacation', 'vacation_year'])
                
                results['processed'] += 1
                results['details'].append({
                    'user': user.username,
                    'entitlement': vacation_entitlement,
                    'taken': taken_vacation_days,
                    'remaining': remaining_vacation,
                    'carryover': carryover,
                    'old_carryover': old_carryover
                })
                
                logger.info(
                    f"✅ {user.username}: "
                    f"Anspruch={vacation_entitlement}, "
                    f"Genommen={taken_vacation_days}, "
                    f"Rest={remaining_vacation}, "
                    f"Übertrag={carryover}"
                )
                
            except Exception as user_exc:
                error_msg = f"User {user.username}: {str(user_exc)}"
                logger.error(f"❌ {error_msg}")
                results['errors'].append(error_msg)
        
        logger.info(
            f"🎉 Resturlaub-Berechnung abgeschlossen: "
            f"{results['processed']} User verarbeitet, "
            f"{len(results['errors'])} Fehler"
        )
        
        return results
        
    except Exception as exc:
        logger.error(f"❌ calculate_carryover_vacation failed: {exc}")
        raise


@shared_task
def expire_carryover_vacation():
    """
    🆕 Phase 2: Lässt Resturlaub verfallen (31.03.)
    
    Läuft automatisch täglich, aber führt nur am 31. März aus
    
    Logik:
    1. Für jeden aktiven User:
       - carryover_vacation auf 0 setzen
    2. Gesetzliche Regelung: Resturlaub verfällt spätestens am 31.03.
    """
    from django.contrib.auth import get_user_model
    from auth_user.models import UserProfile
    
    User = get_user_model()
    today = timezone.now().date()
    
    # Nur am 31. März ausführen
    if today.month != 3 or today.day != 31:
        logger.info(f"⏭️  Skipping carryover expiry (today is {today}, not March 31st)")
        return {'skipped': True, 'reason': 'Not March 31st', 'date': str(today)}
    
    current_year = today.year
    
    try:
        users = User.objects.filter(is_active=True).select_related('profile')
        results = {
            'processed': 0,
            'total_expired_days': 0,
            'errors': []
        }
        
        for user in users:
            try:
                profile = getattr(user, 'profile', None)
                if not profile:
                    logger.warning(f"⚠️  User {user.username} hat kein Profil - überspringe")
                    continue
                
                expired_days = profile.carryover_vacation
                
                if expired_days > 0:
                    profile.carryover_vacation = 0
                    profile.save(update_fields=['carryover_vacation'])
                    
                    results['total_expired_days'] += expired_days
                    logger.info(f"⏰ {user.username}: {expired_days} Resturlaub-Tage verfallen")
                
                results['processed'] += 1
                
            except Exception as user_exc:
                error_msg = f"User {user.username}: {str(user_exc)}"
                logger.error(f"❌ {error_msg}")
                results['errors'].append(error_msg)
        
        logger.info(
            f"🗓️  Resturlaub-Verfall abgeschlossen: "
            f"{results['processed']} User verarbeitet, "
            f"{results['total_expired_days']} Tage insgesamt verfallen, "
            f"{len(results['errors'])} Fehler"
        )
        
        return results
        
    except Exception as exc:
        logger.error(f"❌ expire_carryover_vacation failed: {exc}")
        raise
