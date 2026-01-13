from celery import shared_task
from django.utils import timezone
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)


@shared_task
def reset_monthly_checklist():
    """
    Setzt die Hakliste zum Monatswechsel zurück und fügt neue gültige Einträge hinzu.
    Wird automatisch am 1. jeden Monats ausgeführt.
    - Setzt checked_this_month = False für bestehende Einträge
    - Aktualisiert current_month auf den neuen Monat
    - Fügt neue gültige Einträge hinzu (die im Gültigkeitszeitraum liegen)
    - Entfernt Einträge die nicht mehr gültig sind
    """
    from .models import RecurringWorkOrderChecklist
    
    current_month = timezone.now().strftime('%Y-%m')
    today = date.today()
    
    logger.info(f"Starte monatliches Zurücksetzen der Hakliste für {current_month}")
    
    # Hole alle aktiven Einträge
    all_items = RecurringWorkOrderChecklist.objects.filter(is_active=True)
    
    reset_count = 0
    added_count = 0
    removed_count = 0
    
    # Prüfe welche Einträge gültig sind für diesen Monat
    for item in all_items:
        # Prüfe Gültigkeitszeitraum
        is_valid = True
        if item.valid_from and item.valid_from > today:
            is_valid = False
        if item.valid_until and item.valid_until < today:
            is_valid = False
        
        if is_valid:
            # Eintrag ist gültig - aktualisiere für neuen Monat
            if item.current_month != current_month:
                item.current_month = current_month
                item.checked_this_month = False
                item.save()
                reset_count += 1
        else:
            # Eintrag nicht mehr gültig - entferne aus aktueller Hakliste
            if item.current_month == current_month or not item.current_month:
                # Deaktiviere statt zu löschen (für Historie)
                item.is_active = False
                item.save()
                removed_count += 1
    
    logger.info(
        f"Haklisten-Reset abgeschlossen: {reset_count} zurückgesetzt, "
        f"{added_count} hinzugefügt, {removed_count} entfernt"
    )
    
    return {
        'status': 'success',
        'reset_count': reset_count,
        'added_count': added_count,
        'removed_count': removed_count,
        'month': current_month
    }


@shared_task
def sync_checklist_items():
    """
    Synchronisiert die Hakliste mit den Stammdaten und gleicht mit vorhandenen WorkOrders ab.
    - Kopiert gültige Stammdaten in den aktuellen Monat
    - Prüft automatisch ob passende Arbeitsscheine existieren
    - Hakt automatisch ab wenn Arbeitsscheine gefunden werden
    """
    from .models import RecurringWorkOrderChecklist, WorkOrder
    
    current_month = timezone.now().strftime('%Y-%m')
    today = date.today()
    current_year = today.year
    current_month_num = today.month
    
    logger.info(f"Starte Haklisten-Synchronisation für {current_month}")
    
    # Hole alle aktiven Stammdaten die gültig sind
    active_items = RecurringWorkOrderChecklist.objects.filter(is_active=True)
    
    updated_count = 0
    auto_checked_count = 0
    skipped_count = 0
    
    for item in active_items:
        # Prüfe Gültigkeitszeitraum
        is_valid = True
        if item.valid_from and item.valid_from > today:
            is_valid = False
        if item.valid_until and item.valid_until < today:
            is_valid = False
        
        if not is_valid:
            skipped_count += 1
            continue
        
        # Aktualisiere current_month wenn nicht gesetzt oder veraltet
        needs_update = False
        if item.current_month != current_month:
            item.current_month = current_month
            item.checked_this_month = False
            needs_update = True
            updated_count += 1
        
        # Automatischer Abgleich mit WorkOrders
        if not item.checked_this_month:
            # Match gegen leistungsmonat (Format: YYYY-MM)
            matching_workorders = WorkOrder.objects.filter(
                object_number=item.object_number,
                project_number=item.project_number,
                leistungsmonat=current_month,  # Match gegen current_month statt start_date
                status__in=['submitted', 'billed']  # Eingereichte oder abgerechnete
            )
            
            if matching_workorders.exists():
                item.checked_this_month = True
                item.last_checked_at = timezone.now()
                needs_update = True
                auto_checked_count += 1
                logger.info(
                    f"Automatisch abgehakt: {item.object_number}/{item.project_number} "
                    f"({matching_workorders.count()} abgerechnete Arbeitsscheine gefunden)"
                )
        
        if needs_update:
            item.save()
    
    logger.info(
        f"Synchronisation abgeschlossen: {updated_count} aktualisiert, "
        f"{auto_checked_count} automatisch abgehakt, {skipped_count} übersprungen"
    )
    
    return {
        'status': 'success',
        'updated_count': updated_count,
        'auto_checked_count': auto_checked_count,
        'skipped_count': skipped_count,
        'month': current_month
    }


@shared_task
def cleanup_old_checklist_items():
    """
    Archiviert inaktive Haklisten-Einträge die älter als 12 Monate sind.
    Wird monatlich ausgeführt.
    """
    from .models import RecurringWorkOrderChecklist
    
    cutoff_date = timezone.now() - timezone.timedelta(days=365)
    
    # Setze alte inaktive Einträge auf is_active=False statt sie zu löschen
    updated_count = RecurringWorkOrderChecklist.objects.filter(
        is_active=False,
        updated_at__lt=cutoff_date
    ).delete()[0]
    
    logger.info(f"Alte Haklisten-Einträge gelöscht: {updated_count}")
    
    return {
        'status': 'success',
        'deleted': updated_count
    }
