# sofortmeldung/tasks.py
from celery import shared_task
import logging
from .models import Sofortmeldung
from .services import SofortmelderAPIService

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def process_sofortmeldung(self, sofortmeldung_id):
    """
    Celery Task zur Verarbeitung einer Sofortmeldung
    
    Args:
        sofortmeldung_id: ID des Sofortmeldung-Objekts
    """
    try:
        # Sofortmeldung laden
        sofortmeldung = Sofortmeldung.objects.get(id=sofortmeldung_id)
        
        logger.info(f"Verarbeite Sofortmeldung {sofortmeldung_id} für {sofortmeldung.first_name} {sofortmeldung.last_name}")
        
        # API-Service initialisieren
        api_service = SofortmelderAPIService()
        
        # API-Aufruf
        result = api_service.create_sofortmeldung(sofortmeldung)
        
        if result['success']:
            # Erfolgreiche Übermittlung - Daten aktualisieren
            sofortmeldung.status = True
            sofortmeldung.tan = result.get('tan', '')
            sofortmeldung.url = result.get('pdf_url', '')
            sofortmeldung.save()
            
            logger.info(f"Sofortmeldung {sofortmeldung_id} erfolgreich übermittelt. TAN: {result.get('tan', 'N/A')}")
            
            return {
                'success': True,
                'sofortmeldung_id': sofortmeldung_id,
                'tan': result.get('tan', ''),
                'message': result.get('message', 'Erfolgreich übermittelt')
            }
        else:
            # Fehler bei der Übermittlung
            logger.error(f"Fehler bei Sofortmeldung {sofortmeldung_id}: {result.get('error', 'Unbekannter Fehler')}")
            
            # Retry bei bestimmten Fehlern
            if self.request.retries < self.max_retries:
                logger.info(f"Retry {self.request.retries + 1}/{self.max_retries} für Sofortmeldung {sofortmeldung_id}")
                raise self.retry(countdown=60 * (self.request.retries + 1))
            
            # Maximale Retries erreicht - Status als fehlgeschlagen markieren
            sofortmeldung.status = False
            sofortmeldung.save()
            
            return {
                'success': False,
                'sofortmeldung_id': sofortmeldung_id,
                'error': result.get('error', 'Unbekannter Fehler'),
                'message': result.get('message', 'Übermittlung fehlgeschlagen')
            }
            
    except Sofortmeldung.DoesNotExist:
        logger.error(f"Sofortmeldung mit ID {sofortmeldung_id} nicht gefunden")
        return {
            'success': False,
            'error': 'Sofortmeldung nicht gefunden',
            'sofortmeldung_id': sofortmeldung_id
        }
        
    except Exception as e:
        logger.error(f"Unerwarteter Fehler bei Sofortmeldung {sofortmeldung_id}: {str(e)}")
        
        # Retry bei unerwarteten Fehlern
        if self.request.retries < self.max_retries:
            logger.info(f"Retry {self.request.retries + 1}/{self.max_retries} für Sofortmeldung {sofortmeldung_id}")
            raise self.retry(countdown=60 * (self.request.retries + 1))
        
        return {
            'success': False,
            'error': str(e),
            'sofortmeldung_id': sofortmeldung_id
        }

@shared_task
def check_sofortmeldung_status(sofortmeldung_id):
    """
    Task zur Überprüfung des Status einer Sofortmeldung
    
    Args:
        sofortmeldung_id: ID des Sofortmeldung-Objekts
    """
    try:
        sofortmeldung = Sofortmeldung.objects.get(id=sofortmeldung_id)
        
        if not sofortmeldung.tan:
            logger.warning(f"Keine TAN für Sofortmeldung {sofortmeldung_id} vorhanden")
            return {'success': False, 'error': 'Keine TAN vorhanden'}
        
        api_service = SofortmelderAPIService()
        status_result = api_service.check_status(sofortmeldung.tan)
        
        if status_result.get('success'):
            logger.info(f"Status-Check für Sofortmeldung {sofortmeldung_id} erfolgreich")
            return status_result
        else:
            logger.error(f"Status-Check für Sofortmeldung {sofortmeldung_id} fehlgeschlagen")
            return status_result
            
    except Sofortmeldung.DoesNotExist:
        logger.error(f"Sofortmeldung mit ID {sofortmeldung_id} nicht gefunden")
        return {'success': False, 'error': 'Sofortmeldung nicht gefunden'}
    except Exception as e:
        logger.error(f"Fehler beim Status-Check für Sofortmeldung {sofortmeldung_id}: {str(e)}")
        return {'success': False, 'error': str(e)}

@shared_task
def batch_process_pending_sofortmeldungen():
    """
    Task zur Verarbeitung aller ausstehenden Sofortmeldungen
    """
    pending_meldungen = Sofortmeldung.objects.filter(status=False, tan__isnull=True)
    
    logger.info(f"Verarbeite {pending_meldungen.count()} ausstehende Sofortmeldungen")
    
    for meldung in pending_meldungen:
        process_sofortmeldung.delay(meldung.id)
    
    return {
        'success': True,
        'processed_count': pending_meldungen.count(),
        'message': f'{pending_meldungen.count()} Sofortmeldungen zur Verarbeitung eingereiht'
    }
