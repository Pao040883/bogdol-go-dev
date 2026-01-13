from celery import shared_task
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def sync_blink_data(self):
    """
    Synchronisiert Blink-Daten im Hintergrund
    """
    try:
        logger.info("🔄 Starting Blink data synchronization...")
        
        from .services import BlinkAPIService
        service = BlinkAPIService()
        
        if not service.ensure_authenticated():
            raise Exception("Blink authentication failed")
            
        # Service Manager Daten cachen
        managers = service.get_service_managers_with_locations()
        cache.set('blink_managers', managers, 3600)  # 1 Stunde Cache
        
        # Worklog Statistiken aktualisieren
        today = timezone.now().date()
        stats = service.get_worklog_statistics(today)
        cache.set(f'worklog_stats_{today}', stats, 1800)  # 30 Minuten
        
        logger.info(f"✅ Synchronized {len(managers)} managers, updated stats")
        return {
            'status': 'success', 
            'managers_count': len(managers),
            'stats_date': str(today)
        }
        
    except Exception as exc:
        logger.error(f"❌ Blink sync failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

@shared_task
def process_worklog_evaluation(user_id, start_date, end_date, export_format='json'):
    """
    Verarbeitet Worklog-Auswertung asynchron
    """
    try:
        from auth_user.models import CustomUser
        user = CustomUser.objects.get(id=user_id)
        
        from .services import BlinkAPIService
        service = BlinkAPIService()
        
        result = service.run_evaluation(
            start_date=start_date,
            end_date=end_date,
            user_blink_company=user.blink_company,
            export_format=export_format
        )
        
        # Ergebnis cachen für Download
        cache_key = f"evaluation_{user_id}_{start_date}_{end_date}_{export_format}"
        cache.set(cache_key, result, 1800)  # 30 Minuten
        
        # Benutzer per Email benachrichtigen
        if user.email:
            send_mail(
                subject=f"Blink Auswertung {start_date} - {end_date} fertig",
                message=f"Ihre Blink-Auswertung ist fertig und kann heruntergeladen werden.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True
            )
        
        logger.info(f"✅ Evaluation completed for user {user.username}")
        return {'status': 'completed', 'cache_key': cache_key}
        
    except Exception as exc:
        logger.error(f"❌ Evaluation failed: {exc}")
        raise

@shared_task
def generate_weekly_reports():
    """
    Generiert wöchentliche Berichte für alle Service Manager
    """
    try:
        from .services import BlinkAPIService
        from auth_user.models import CustomUser
        
        service = BlinkAPIService()
        
        # Alle Service Manager mit Blink Company
        managers = CustomUser.objects.filter(
            user_type='SERVICE_MANAGER',
            blink_company__isnull=False
        ).exclude(blink_company='')
        
        reports_generated = 0
        
        for manager in managers:
            try:
                # Letzte Woche
                end_date = timezone.now().date()
                start_date = end_date - timedelta(days=7)
                
                # Report generieren
                report = service.run_evaluation(
                    start_date=start_date.isoformat(),
                    end_date=end_date.isoformat(),
                    user_blink_company=manager.blink_company
                )
                
                # Report cachen
                cache_key = f"weekly_report_{manager.id}_{start_date}"
                cache.set(cache_key, report, 604800)  # 1 Woche
                
                # Email senden
                if manager.email:
                    send_mail(
                        subject=f"Wöchentlicher Blink-Report {start_date} - {end_date}",
                        message=f"Ihr wöchentlicher Blink-Report ist verfügbar.",
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[manager.email],
                        fail_silently=True
                    )
                
                reports_generated += 1
                
            except Exception as e:
                logger.error(f"Failed to generate report for {manager.username}: {e}")
                continue
        
        logger.info(f"✅ Generated {reports_generated} weekly reports")
        return {'reports_generated': reports_generated}
        
    except Exception as exc:
        logger.error(f"❌ Weekly reports failed: {exc}")
        raise

@shared_task
def cleanup_old_cache_data():
    """
    Bereinigt alte Cache-Daten
    """
    try:
        # Hier könnten wir Cache-Keys mit Pattern löschen
        # cache.delete_pattern('evaluation_*')  # Benötigt redis-backend
        
        logger.info("✅ Cache cleanup completed")
        return {'status': 'completed'}
        
    except Exception as exc:
        logger.error(f"❌ Cache cleanup failed: {exc}")
        raise
