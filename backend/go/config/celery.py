import os
from celery import Celery
from django.conf import settings

# Django Settings für Celery setzen
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Celery App erstellen
app = Celery('bogdol_go')

# Konfiguration aus Django Settings laden
app.config_from_object('django.conf:settings', namespace='CELERY')

# Tasks automatisch discovery
app.autodiscover_tasks()

# Celery Beat Schedule
app.conf.beat_schedule = {
    'sync-blink-data': {
        'task': 'blink_integration.tasks.sync_blink_data',
        'schedule': 3600.0,  # Jede Stunde
        'options': {'queue': 'blink'}
    },
    'cleanup-old-logs': {
        'task': 'core.tasks.cleanup_old_logs',
        'schedule': 86400.0,  # Täglich
        'options': {'queue': 'default'}
    },
    'send-absence-reminders': {
        'task': 'absences.tasks.send_absence_reminders',
        'schedule': 28800.0,  # Alle 8 Stunden  
        'options': {'queue': 'absences'}
    },
    'generate-weekly-reports': {
        'task': 'blink_integration.tasks.generate_weekly_reports',
        'schedule': 604800.0,  # Wöchentlich (Sonntag)
        'options': {'queue': 'blink'}
    },
    'ensure-next-year-holidays': {
        'task': 'absences.tasks.ensure_next_year_holidays',
        'schedule': 86400.0,  # Täglich (prüft ob Dezember und erstellt für nächstes Jahr)
        'options': {'queue': 'absences'}
    },
    'update-vacation-year': {
        'task': 'auth_user.tasks.update_vacation_year',
        'schedule': 86400.0,  # Täglich (führt nur am 1. Januar aus)
        'options': {'queue': 'default'}
    },
    'check-vacation-expiry': {
        'task': 'auth_user.tasks.check_vacation_expiry',
        'schedule': 2592000.0,  # Monatlich (30 Tage)
        'options': {'queue': 'default'}
    },
    'reset-monthly-checklist': {
        'task': 'workorders.tasks.reset_monthly_checklist',
        'schedule': 2592000.0,  # Monatlich (30 Tage) - am 1. des Monats
        'options': {'queue': 'default'}
    },
    # 🆕 Phase 2: Urlaubssaldo-Cronjobs
    'calculate-carryover-vacation': {
        'task': 'absences.tasks.calculate_carryover_vacation',
        'schedule': 86400.0,  # Täglich (führt nur am 31.12. aus)
        'options': {'queue': 'absences'}
    },
    'expire-carryover-vacation': {
        'task': 'absences.tasks.expire_carryover_vacation',
        'schedule': 86400.0,  # Täglich (führt nur am 31.03. aus)
        'options': {'queue': 'absences'}
    },
}

# Celery Konfiguration
app.conf.update(
    timezone='UTC',
    enable_utc=True,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 Minuten
    task_soft_time_limit=25 * 60,  # 25 Minuten
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Task Routes für Queue-Management
app.conf.task_routes = {
    'blink_integration.tasks.*': {'queue': 'blink'},
    'absences.tasks.*': {'queue': 'absences'},
    'core.tasks.*': {'queue': 'default'},
    'auth_user.tasks.*': {'queue': 'default'},
    'workorders.tasks.*': {'queue': 'default'},
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
    return {'status': 'debug_task_completed', 'worker': self.request.hostname}
