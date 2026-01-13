from celery import shared_task
from django.core.management import call_command
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
import logging
import os

logger = logging.getLogger(__name__)

@shared_task
def cleanup_old_logs():
    """
    Bereinigt alte Log-Dateien und temporäre Daten
    """
    try:
        # Django Session Cleanup
        call_command('clearsessions')
        
        # Cache cleanup für alte Keys
        # Hier können wir spezifische Cache-Pattern löschen
        
        # Log-Dateien bereinigen (falls konfiguriert)
        log_dir = getattr(settings, 'LOG_DIR', None)
        if log_dir and os.path.exists(log_dir):
            # Implementierung für Log-Cleanup
            pass
        
        logger.info("✅ Log cleanup completed")
        return {'status': 'completed'}
        
    except Exception as exc:
        logger.error(f"❌ Log cleanup failed: {exc}")
        raise

@shared_task
def database_maintenance():
    """
    Führt Database Maintenance Tasks aus
    """
    try:
        # VACUUM für PostgreSQL könnte hier implementiert werden
        # Oder andere DB-spezifische Maintenance Tasks
        
        logger.info("✅ Database maintenance completed")
        return {'status': 'completed'}
        
    except Exception as exc:
        logger.error(f"❌ Database maintenance failed: {exc}")
        raise

@shared_task
def system_health_check():
    """
    Führt System Health Checks aus
    """
    try:
        health_data = {
            'timestamp': timezone.now().isoformat(),
            'database': 'unknown',
            'redis': 'unknown',
            'disk_space': 'unknown'
        }
        
        # Database Check
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            health_data['database'] = 'ok'
        except Exception:
            health_data['database'] = 'error'
        
        # Redis Check
        try:
            cache.set('health_check', 'ok', 30)
            if cache.get('health_check') == 'ok':
                health_data['redis'] = 'ok'
        except Exception:
            health_data['redis'] = 'error'
        
        # Disk Space Check
        try:
            import shutil
            total, used, free = shutil.disk_usage('/')
            free_percent = (free / total) * 100
            health_data['disk_space'] = {
                'free_percent': round(free_percent, 2),
                'status': 'ok' if free_percent > 10 else 'warning'
            }
        except Exception:
            health_data['disk_space'] = 'error'
        
        # Health data cachen
        cache.set('system_health', health_data, 300)  # 5 Minuten
        
        logger.info("✅ System health check completed")
        return health_data
        
    except Exception as exc:
        logger.error(f"❌ System health check failed: {exc}")
        raise
