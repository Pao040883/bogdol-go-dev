"""
Celery Tasks für User-Management und Urlaubsverwaltung
"""
from celery import shared_task
from django.utils import timezone
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)

User = get_user_model()


@shared_task
def update_vacation_year():
    """
    Automatische Jahreswechsel-Logik für Urlaubsansprüche
    
    Wird täglich geprüft, aber nur am 1. Januar ausgeführt:
    1. Berechnet Resturlaub aus dem Vorjahr
    2. Setzt carryover_vacation auf den verbleibenden Urlaub
    3. Erhöht vacation_year um 1
    4. Begrenzt Resturlaub optional (z.B. max. 5 Tage)
    """
    now = timezone.now()
    current_year = now.year
    
    # Nur am 1. Januar ausführen
    if now.month != 1 or now.day != 1:
        logger.info(f"ℹ️ Urlaubsjahreswechsel: Nicht am 1. Januar (aktuell: {now.date()})")
        return {'status': 'skipped', 'reason': 'not_january_1st'}
    
    logger.info(f"🔄 Starte Urlaubsjahreswechsel für {current_year}")
    
    users_updated = 0
    
    for user in User.objects.filter(is_active=True):
        # Überspringe Benutzer, die bereits auf das neue Jahr aktualisiert wurden
        if user.vacation_year >= current_year:
            continue
            
        try:
            # Berechne verbleibenden Urlaub aus dem Vorjahr
            previous_year = user.vacation_year
            remaining_days = user.get_remaining_vacation_days(previous_year)
            
            # Optional: Begrenze Resturlaub (z.B. maximal 5 Tage)
            # Kommentiere diese Zeile aus, wenn keine Begrenzung gewünscht ist
            # remaining_days = min(remaining_days, 5)
            
            # Aktualisiere User-Daten
            user.carryover_vacation = remaining_days
            user.vacation_year = current_year
            user.save(update_fields=['carryover_vacation', 'vacation_year'])
            
            users_updated += 1
            logger.info(
                f"✅ User {user.username}: "
                f"Resturlaub {previous_year} → {current_year}: {remaining_days} Tage"
            )
            
        except Exception as e:
            logger.error(f"❌ Fehler bei User {user.username}: {e}")
    
    logger.info(f"✨ Urlaubsjahreswechsel abgeschlossen: {users_updated} Benutzer aktualisiert")
    return {
        'users_updated': users_updated,
        'year': current_year
    }


@shared_task
def check_vacation_expiry():
    """
    Prüft und warnt vor ablaufendem Resturlaub
    
    Wird monatlich ausgeführt und sendet Benachrichtigungen an Benutzer
    mit hohem Resturlaub, der bald verfällt (z.B. im Oktober/November)
    """
    current_year = timezone.now().year
    current_month = timezone.now().month
    users_at_risk = []
    
    # Nur in den letzten Monaten des Jahres warnen (Oktober-Dezember)
    if current_month < 10:
        logger.info("ℹ️ Zu früh im Jahr für Resturlaub-Warnungen")
        return {'users_warned': 0}
    
    logger.info("🔔 Prüfe ablaufenden Resturlaub")
    
    for user in User.objects.filter(is_active=True, vacation_year=current_year):
        remaining = user.get_remaining_vacation_days(current_year)
        
        # Warne bei mehr als 10 verbleibenden Tagen ab Oktober
        if remaining > 10:
            users_at_risk.append({
                'username': user.username,
                'email': user.email,
                'remaining_days': remaining
            })
            logger.warning(
                f"⚠️ User {user.username} hat noch {remaining} Urlaubstage verfügbar"
            )
            
            # TODO: Hier könnte eine E-Mail-Benachrichtigung gesendet werden
            # send_vacation_reminder_email(user, remaining)
    
    logger.info(f"📊 {len(users_at_risk)} Benutzer mit hohem Resturlaub gefunden")
    return {
        'users_warned': len(users_at_risk),
        'users': users_at_risk
    }


@shared_task
def sync_vacation_data_for_year(year: int):
    """
    Synchronisiert Urlaubsdaten für ein bestimmtes Jahr
    
    Kann manuell aufgerufen werden, um Urlaubsdaten für ein bestimmtes Jahr
    zu aktualisieren, z.B. nach Migrationen oder Korrekturen
    """
    logger.info(f"🔄 Synchronisiere Urlaubsdaten für Jahr {year}")
    users_updated = 0
    
    for user in User.objects.filter(is_active=True):
        if user.vacation_year != year:
            user.vacation_year = year
            user.save(update_fields=['vacation_year'])
            users_updated += 1
            
    logger.info(f"✅ {users_updated} Benutzer auf Jahr {year} aktualisiert")
    return {'users_updated': users_updated, 'year': year}
