# sofortmeldung/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging
from .models import Sofortmeldung
from .tasks import process_sofortmeldung

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Sofortmeldung)
def handle_sofortmeldung_created(sender, instance, created, **kwargs):
    """
    Signal-Handler für neue Sofortmeldungen
    
    Startet automatisch die Verarbeitung, wenn eine neue Sofortmeldung erstellt wird
    """
    if created:
        logger.info(f"Neue Sofortmeldung erstellt: ID {instance.id} für {instance.first_name} {instance.last_name}")
        
        # Task in die Celery-Queue einreihen
        process_sofortmeldung.delay(instance.id)
        
        logger.info(f"Verarbeitungs-Task für Sofortmeldung {instance.id} eingereiht")

@receiver(post_save, sender=Sofortmeldung)
def handle_sofortmeldung_updated(sender, instance, created, **kwargs):
    """
    Signal-Handler für aktualisierte Sofortmeldungen
    
    Kann für zusätzliche Logik bei Updates verwendet werden
    """
    if not created:
        logger.debug(f"Sofortmeldung {instance.id} aktualisiert")
        
        # Hier könnten weitere Aktionen bei Updates ausgeführt werden
        # z.B. Benachrichtigungen, Audit-Logs, etc.
