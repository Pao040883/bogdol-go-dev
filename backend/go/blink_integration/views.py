# blink_integration/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from datetime import datetime, date
from django.contrib.auth import get_user_model
import logging

from .services import BlinkAPIService

logger = logging.getLogger(__name__)
User = get_user_model()

@api_view(['GET'])
def test_endpoint(request):
    """Test endpoint to verify basic functionality"""
    logger.info("🔧 Test endpoint called")
    return Response({
        'message': 'Backend is working!',
        'timestamp': datetime.now().isoformat()
    })

@api_view(['GET'])
@permission_classes([])  # Keine Authentifizierung für Test
def check_config_endpoint(request):
    """Überprüft die Blink-Konfiguration"""
    try:
        from django.conf import settings
        
        config_info = {
            'blink_username_configured': hasattr(settings, 'BLINK_USERNAME') and bool(settings.BLINK_USERNAME),
            'blink_password_configured': hasattr(settings, 'BLINK_PASSWORD') and bool(settings.BLINK_PASSWORD),
            'blink_username': settings.BLINK_USERNAME if hasattr(settings, 'BLINK_USERNAME') else 'NOT_SET',
            'blink_password_length': len(settings.BLINK_PASSWORD) if hasattr(settings, 'BLINK_PASSWORD') else 0,
            'api_base_url': 'https://bogdol-api.blink.online'
        }
        
        logger.info(f"🔧 Blink Konfiguration: {config_info}")
        
        return Response({
            'status': 'success',
            'config': config_info,
            'recommendation': 'Überprüfen Sie, ob der BLINK_USERNAME korrekt ist und ob dieser User in Ihrem Blink-System existiert'
        })
        
    except Exception as e:
        logger.error(f"🔧 ❌ Config-Check Fehler: {e}")
        return Response({
            'status': 'error',
            'message': f'Fehler: {str(e)}'
        }, status=500)

@api_view(['GET'])
@permission_classes([])  # Keine Authentifizierung für Test
def test_auth_endpoint(request):
    """Test-Endpoint für Blink API Authentifizierung"""
    try:
        logger.info("🧪 Test-Endpunkt für Blink API Authentifizierung aufgerufen")
        
        # Test user laden
        try:
            user = User.objects.get(username='poffermanns')
            logger.info(f"🧪 Test User gefunden: {user.username}, blink_id: {user.blink_id}, blink_company: {user.blink_company}")
        except User.DoesNotExist:
            return Response({'error': 'Test user nicht gefunden'}, status=400)
        
        # Blink Service initialisieren
        blink_service = BlinkAPIService()
        logger.info("🧪 BlinkAPIService initialisiert")
        
        # Nur Authentifizierung testen
        auth_success = blink_service.authenticate()
        
        if auth_success:
            logger.info("🧪 ✅ Authentifizierung erfolgreich!")
            return Response({
                'status': 'success',
                'message': 'Blink API Authentifizierung erfolgreich',
                'auth_token_length': len(blink_service.auth_token) if blink_service.auth_token else 0
            })
        else:
            logger.error("🧪 ❌ Authentifizierung fehlgeschlagen")
            return Response({
                'status': 'error',
                'message': 'Blink API Authentifizierung fehlgeschlagen',
                'details': 'User existiert nicht in diesem Blink-System oder falsche Credentials',
                'solution': 'Überprüfen Sie BLINK_USERNAME und BLINK_PASSWORD in den Django Settings'
            }, status=200)  # Status 200 damit Frontend die Details sieht
            
    except Exception as e:
        logger.error(f"🧪 ❌ Test-Endpunkt Fehler: {e}")
        return Response({
            'status': 'error',
            'message': f'Fehler: {str(e)}'
        }, status=500)

@api_view(['GET', 'POST'])
@permission_classes([])  # Temporär deaktiviert für Tests
def run_blink_evaluation(request):
    """
    Sichere Blink Auswertung über Backend
    """
    try:
        # Parameter aus Request (sowohl GET als auch POST unterstützen)
        if request.method == 'GET':
            start_date_str = request.GET.get('start_date')
            end_date_str = request.GET.get('end_date')
            username = request.GET.get('username', 'poffermanns')
        else:
            data = request.data
            logger.info(f"Request data: {data}")
            start_date_str = data.get('startDate')
            end_date_str = data.get('endDate')
            username = data.get('username', 'poffermanns')
        
        logger.info(f"🔄 Blink evaluation request for user: {username}")
        logger.info(f"📅 Date range: {start_date_str} to {end_date_str}")
        
        # Spezifischen User laden
        from auth_user.models import CustomUser
        try:
            user = CustomUser.objects.get(username=username)
            logger.info(f"✅ User gefunden: {user.username}")
        except CustomUser.DoesNotExist:
            return Response({
                'error': f'User {username} nicht gefunden'
            }, status=status.HTTP_404_NOT_FOUND)
        
        logger.info(f"Using user: {user.username}")
        logger.info(f"User blink_id: {getattr(user, 'blink_id', 'NOT SET')}")
        logger.info(f"User blink_company: {getattr(user, 'blink_company', 'NOT SET')}")
        
        if not hasattr(user, 'blink_id') or not hasattr(user, 'blink_company'):
            logger.error("User hat keine blink_id oder blink_company Felder")
            return Response({
                'error': 'Blink Integration nicht konfiguriert. Bitte Blink ID und Company in Profil hinterlegen.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.blink_id or not user.blink_company:
            logger.error(f"User blink_id oder blink_company sind leer: id={user.blink_id}, company={user.blink_company}")
            return Response({
                'error': 'Blink ID und Company ID sind erforderlich.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not start_date_str or not end_date_str:
            logger.error(f"Start- oder Enddatum fehlen: start={start_date_str}, end={end_date_str}")
            return Response({
                'error': 'Start- und Enddatum sind erforderlich.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Datum parsen
        try:
            logger.info(f"Parsing dates: start={start_date_str}, end={end_date_str}")
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
            logger.info(f"Parsed dates: start={start_date}, end={end_date}")
        except ValueError as e:
            logger.error(f"Fehler beim Parsen der Daten: {e}")
            return Response({
                'error': 'Ungültiges Datumsformat.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Blink API Service initialisieren
        logger.info("Initialisiere Blink API Service...")
        try:
            blink_service = BlinkAPIService()
            logger.info("✅ Blink API Service erfolgreich initialisiert")
        except Exception as e:
            logger.error(f"❌ Fehler beim Initialisieren des Blink API Service: {e}")
            return Response({
                'error': f'Fehler bei der API-Initialisierung: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Daten parallel laden
        try:
            logger.info(f"🏢 User Company: {user.blink_company}, User ID: {user.blink_id}")
            
            # Verwende neue Employee-basierte Implementierung (wie Frontend)
            managers = blink_service.get_service_managers_with_locations(
                user_blink_company=user.blink_company,
                user_blink_id=user.blink_id if not user.is_staff else None
            )

            # Lade Worklogs (für Datenstruktur, nicht für Anzeige)
            worklogs = blink_service.fetch_worklogs(
                start_date=start_date,
                end_date=end_date,
                user_blink_company=user.blink_company
            )

            # Locations sind bereits in den Managern enthalten
            all_locations = []
            for manager in managers:
                all_locations.extend(manager.get('locations', []))
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Blink-Daten: {e}")
            return Response({
                'error': f'Fehler beim Laden der Daten: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Debug Informationen loggen
        logger.info(f"📊 Datenübersicht:")
        logger.info(f"   - Manager: {len(managers)}")
        logger.info(f"   - Worklogs: {len(worklogs)}")
        logger.info(f"   - Locations: {len(all_locations)}")
        
        # Daten aggregieren MIT Worklogs (wie evaluations Ordner)
        result = aggregate_evaluation_data_with_worklogs(managers, worklogs, all_locations, start_date, end_date)
        
        return Response({
            'success': True,
            'data': result,
            'meta': {
                'user_company': user.blink_company,
                'user_id': user.blink_id,
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                },
                'generated_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Unerwarteter Fehler in Blink Auswertung: {e}")
        return Response({
            'error': f'Unerwarteter Fehler: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def aggregate_evaluation_data_with_worklogs(managers, worklogs, locations, start_date, end_date):
    """
    Aggregation MIT Worklogs UND vollständigen Statistics für Frontend
    """
    logger.info("🔄 Aggregiere Daten MIT Worklogs UND Statistics für Frontend...")
    
    # Manager mit Worklog-Daten erweitern (wie evaluations aggregateData)
    result_managers = []
    
    for manager in managers:
        manager_id = manager['id']
        managed_locations = manager.get('locations', [])
        
        logger.info(f"👤 Manager {manager['fullName']} ({manager_id}): {len(managed_locations)} Locations")
        
        # Statistics-Variablen initialisieren
        total_worklogs = 0
        exported_worklogs = 0
        overall_status_counts = {}
        completed_locations = 0  # ✅ LOCATION-BASIERTE ZÄHLUNG
        
        # Location-Details mit Worklogs aufbereiten (wie evaluations)
        location_details = []
        for managed_loc in managed_locations:
            location_id = managed_loc['id']
            
            # Finde Worklogs für diese Location (wie evaluations)
            location_worklogs = [wl for wl in worklogs if wl.get('LocationId') == location_id]
            
            # Status-Zusammenfassung (wie evaluations)
            statuses = {}
            location_is_complete = True  # ✅ LOCATION-VOLLSTÄNDIGKEIT PRÜFEN
            
            # ✅ WICHTIG: Wenn keine Worklogs vorhanden sind, als "Nicht bearbeitet" werten
            if not location_worklogs:
                statuses['Nicht bearbeitet'] = 1  # Zeigt an, dass Location keine Daten hat
                total_worklogs += 1  # Zählt als "nicht exportiert"
                location_is_complete = False  # ✅ LOCATION OHNE WORKLOGS IST NICHT VOLLSTÄNDIG
            else:
                for wl in location_worklogs:
                    status = wl.get('Status', 'New')
                    statuses[status] = statuses.get(status, 0) + 1
                    overall_status_counts[status] = overall_status_counts.get(status, 0) + 1
                    
                    # Worklog-Statistiken sammeln (nur Anzahl, keine Minuten)
                    total_worklogs += 1
                    
                    # ✅ PRÜFE OB DIESES WORKLOG EXPORTIERT IST
                    if status in ['Exported', 'Approved', 'Billed']:
                        exported_worklogs += 1
                    else:
                        # ✅ WENN EIN WORKLOG NICHT EXPORTIERT IST, IST DIE GANZE LOCATION NICHT VOLLSTÄNDIG
                        location_is_complete = False
            
            # ✅ LOCATION ALS VOLLSTÄNDIG ZÄHLEN, NUR WENN ALLE WORKLOGS EXPORTIERT SIND
            if location_is_complete and len(location_worklogs) > 0:
                completed_locations += 1
            
            # Location-Daten im Frontend-Format (mit Großschreibung)
            location_data = {
                'Id': location_id,                              # ✅ Frontend erwartet 'Id' 
                'Name': managed_loc['name'],                     # ✅ Frontend erwartet 'Name'
                'Address': managed_loc.get('address', ''),      # ✅ Optional
                'City': managed_loc.get('city', ''),            # ✅ Optional
                'objectNumber': managed_loc.get('objectNumber', ''),
                'worklogs': location_worklogs,  # Worklogs für Datenstruktur
                'statuses': statuses,  # Status-Zusammenfassung (auch "Nicht bearbeitet")
                'areas': managed_loc.get('areas', []),  # Areas als Array
                'hasData': len(location_worklogs) > 0  # ✅ Flag für Frontend
            }
            location_details.append(location_data)
        
        # ✅ LOCATION-BASIERTE Export-Prozentsatz berechnung
        total_locations = len(location_details)
        location_export_percentage = (completed_locations / total_locations * 100) if total_locations > 0 else 0
        
        logger.info(f"👤 Manager {manager['fullName']}: {completed_locations}/{total_locations} Locations vollständig = {location_export_percentage:.1f}%")
        
        # Manager-Objekt im EXAKTEN Frontend-Format MIT location-basierter Statistics
        manager_data = {
            'id': manager_id,
            'firstName': manager['firstName'],
            'lastName': manager['lastName'],
            'fullName': f"{manager['firstName']} {manager['lastName']}",  # ✅ HINZUGEFÜGT
            'statistics': {                                               # ✅ LOCATION-BASIERTE STATISTIK
                'totalWorklogs': total_worklogs,
                'totalMinutes': 0,  # Nicht verwendet, aber für Kompatibilität
                'totalHours': 0,    # Nicht verwendet, aber für Kompatibilität
                'exportedWorklogs': exported_worklogs,
                'exportPercentage': location_export_percentage,  # ✅ LOCATION-BASIERT
                'uniqueLocations': len(location_details),
                'completedLocations': completed_locations,  # ✅ NEUE METRIK
                'statusCounts': overall_status_counts
            },
            'locations': location_details,
            'areas': []  # Kann aus locations berechnet werden
        }
        
        # Areas aus allen Locations sammeln (wie evaluations)
        for loc in location_details:
            manager_data['areas'].extend(loc.get('areas', []))
        
        result_managers.append(manager_data)
    
    # Gesamtstatistiken berechnen (Location-basiert)
    total_managers = len(result_managers)
    managers_with_data = len([m for m in result_managers if m['statistics']['totalWorklogs'] > 0])
    total_locations = sum(len(m['locations']) for m in result_managers)
    total_worklogs = sum(m['statistics']['totalWorklogs'] for m in result_managers)
    total_completed_locations = sum(m['statistics']['completedLocations'] for m in result_managers)
    
    # ✅ GESAMT-EXPORT-PROZENTSATZ BASIERT AUF LOCATIONS, NICHT WORKLOGS
    overall_export_percentage = (total_completed_locations / total_locations * 100) if total_locations > 0 else 0
    
    # Alle Locations für separate locations Array sammeln
    all_locations = []
    for manager in result_managers:
        for location in manager['locations']:
            all_locations.append({
                'Id': location['Id'],
                'Name': location['Name'],
                'Address': location.get('Address', ''),
                'City': location.get('City', '')
            })
    
    result = {
        'serviceManagers': result_managers,
        'summary': {
            'totalManagers': total_managers,
            'managersWithData': managers_with_data,
            'totalLocations': total_locations,
            'overallExportPercentage': overall_export_percentage,
            'totalWorklogs': total_worklogs,
            'totalMinutes': 0,  # Nicht verwendet
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'days': (end_date - start_date).days + 1
            }
        },
        'locations': all_locations  # ✅ Frontend erwartet separates locations Array
    }
    
    logger.info(f"✅ Location-basierte Aggregation abgeschlossen: {total_managers} Manager, {total_completed_locations}/{total_locations} Locations vollständig, {overall_export_percentage:.1f}% completed")
    return result
