# sofortmeldung/services.py
import requests
import logging
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from .models import Sofortmeldung
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SofortmelderAPIService:
    """Service für die Integration mit der Sofortmelder.de API mit Token-Management"""
    
    def __init__(self):
        self.base_url = getattr(settings, 'SOFORTMELDER_API_URL', 'https://api.sofortmelder.de')
        self.refresh_token = getattr(settings, 'SOFORTMELDER_REFRESH_TOKEN', '')
        self.initial_access_token = getattr(settings, 'SOFORTMELDER_ACCESS_TOKEN', '')
        self.company_number = getattr(settings, 'SOFORTMELDER_COMPANY_NUMBER', '')
        
        # Cache-Keys für Token-Management
        self.access_token_cache_key = 'sofortmelder_access_token'
        self.refresh_token_cache_key = 'sofortmelder_refresh_token'
        
        if not all([self.refresh_token, self.company_number]):
            raise ValueError("Sofortmelder API Konfiguration unvollständig. Bitte SOFORTMELDER_REFRESH_TOKEN und SOFORTMELDER_COMPANY_NUMBER in settings.py setzen.")
        
        # Initiales Access Token in Cache setzen falls noch nicht vorhanden
        if self.initial_access_token and not cache.get(self.access_token_cache_key):
            # Token für sehr lange Zeit cachen (da es erst 2026 abläuft)
            cache.set(self.access_token_cache_key, self.initial_access_token, 365 * 24 * 60 * 60)  # 1 Jahr
            logger.info("Initiales Access Token in Cache gesetzt")
    
    def get_access_token(self):
        """
        Holt das Access Token (bevorzugt aus Cache, sonst Refresh)
        
        Returns:
            str: Gültiges Access Token oder None bei Fehler
        """
        # Prüfe ob Access Token im Cache vorhanden
        access_token = cache.get(self.access_token_cache_key)
        if access_token:
            logger.debug("Access Token aus Cache geladen")
            return access_token
        
        # Falls kein Token im Cache, versuche Refresh
        logger.info("Kein Access Token im Cache, versuche Refresh...")
        return self.refresh_access_token()
    
    def refresh_access_token(self):
        """
        Erneuert das Access Token mit dem Refresh Token
        
        Returns:
            str: Neues Access Token oder None bei Fehler
        """
        try:
            # Aktuelles Refresh Token holen (erst aus Cache, dann aus Settings)
            current_refresh_token = cache.get(self.refresh_token_cache_key)
            if not current_refresh_token:
                current_refresh_token = self.refresh_token
            
            logger.info("Erneuere Access Token...")
            
            payload = {
                "refreshToken": current_refresh_token
            }
            
            response = requests.post(
                f'{self.base_url}/v1/client/refresh/token',
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200 or response.status_code == 201:  # 201 für neue Token
                result = response.json()
                if result.get('statusCode') in [200, 201] and result.get('type') == 'success':
                    data = result.get('data', {})
                    new_access_token = data.get('accessToken')
                    new_refresh_token = data.get('refreshToken')
                    
                    if new_access_token:
                        # Access Token für lange Zeit cachen (läuft erst 2026 ab)
                        cache.set(self.access_token_cache_key, new_access_token, 365 * 24 * 60 * 60)  # 1 Jahr
                        logger.info("Access Token erfolgreich erneuert")
                        
                        # Neues Refresh Token speichern falls vorhanden
                        if new_refresh_token:
                            cache.set(self.refresh_token_cache_key, new_refresh_token, 30 * 24 * 60 * 60)  # 30 Tage
                            logger.info("Refresh Token ebenfalls aktualisiert")
                            
                            # TODO: Neues Refresh Token auch in Settings/Env updaten
                            # In Production sollte dies in einer sicheren Konfigurationsdatei gespeichert werden
                            logger.warning(f"WICHTIG: Neues Refresh Token in Konfiguration updaten: {new_refresh_token}")
                        
                        return new_access_token
                    else:
                        logger.error("Kein Access Token in Response erhalten")
                        return None
                else:
                    logger.error(f"Token-Refresh fehlgeschlagen: {result}")
                    return None
            elif response.status_code == 400:
                result = response.json()
                logger.error(f"Ungültiger Refresh Token: {result}")
                # Cache löschen bei ungültigem Token
                cache.delete(self.refresh_token_cache_key)
                return None
            elif response.status_code == 429:
                result = response.json()
                retry_after = result.get('retryAfter', 3600)
                logger.error(f"Rate Limit bei Token-Refresh: {result}")
                return None
            else:
                logger.error(f"Token-Refresh Fehler {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Token-Refresh: {e}")
            return None
    
    def get_headers(self):
        """Erstelle Standard-Headers für API-Aufrufe mit Bearer Token"""
        access_token = self.get_access_token()
        if not access_token:
            raise ValueError("Kein gültiges Access Token verfügbar")
        
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'User-Agent': 'Bogdol-GO/1.0'
        }
    
    def make_authenticated_request(self, method, endpoint, **kwargs):
        """
        Macht einen authentifizierten API-Request mit automatischem Token-Refresh
        
        Args:
            method: HTTP-Method (GET, POST, etc.)
            endpoint: API-Endpunkt (ohne base_url)
            **kwargs: Zusätzliche Parameter für requests
            
        Returns:
            requests.Response: API-Response
        """
        url = f"{self.base_url}{endpoint}"
        
        # Ersten Versuch mit aktuellem Token
        try:
            headers = self.get_headers()
            response = getattr(requests, method.lower())(url, headers=headers, **kwargs)
            
            # Bei 401 Token refresh versuchen (nur dann!)
            if response.status_code == 401:
                logger.info("Access Token ungültig/abgelaufen (401), versuche Refresh...")
                
                # Cache löschen und neues Token holen
                cache.delete(self.access_token_cache_key)
                new_token = self.refresh_access_token()
                
                if new_token:
                    # Zweiter Versuch mit neuem Token
                    logger.info("Wiederhole Request mit neuem Token...")
                    headers = self.get_headers()
                    response = getattr(requests, method.lower())(url, headers=headers, **kwargs)
                    logger.info(f"Retry-Response: {response.status_code}")
                else:
                    logger.error("Token-Refresh fehlgeschlagen - kann Request nicht wiederholen")
            
            return response
            
        except Exception as e:
            logger.error(f"Fehler bei authentifiziertem Request: {e}")
            raise
    
    def create_sofortmeldung(self, sofortmeldung: Sofortmeldung):
        """
        Sendet eine Sofortmeldung an die API
        
        Args:
            sofortmeldung: Das Sofortmeldung-Model-Objekt
            
        Returns:
            dict: API-Response mit TAN und PDF-URL
        """
        try:
            # Prepare API payload basierend auf echter API-Spec
            payload = self._prepare_payload(sofortmeldung)
            
            # API-Aufruf an /v1/sofortmeldung/create mit Token-Auth
            response = self.make_authenticated_request(
                'POST',
                '/v1/sofortmeldung/create',
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('status') == 200 and result.get('type') == 'success':
                    data_section = result.get('data', {})
                    logger.info(f"Sofortmeldung erfolgreich erstellt für {sofortmeldung.first_name} {sofortmeldung.last_name}")
                    return {
                        'success': True,
                        'tan': data_section.get('tan', ''),
                        'pdf_url': data_section.get('url', ''),
                        'message': 'Sofortmeldung erfolgreich übermittelt'
                    }
                else:
                    logger.error(f"API Response zeigt Fehler: {result}")
                    return {
                        'success': False,
                        'error': f"API Response Fehler: {result.get('message', 'Unbekannter Fehler')}"
                    }
            elif response.status_code == 403:
                # Validierungsfehler
                result = response.json()
                errors = result.get('errors', {})
                error_messages = self._extract_validation_errors(errors)
                logger.error(f"Validierungsfehler für {sofortmeldung.first_name} {sofortmeldung.last_name}: {error_messages}")
                return {
                    'success': False,
                    'error': f"Validierungsfehler: {'; '.join(error_messages)}",
                    'validation_errors': errors
                }
            elif response.status_code == 401:
                result = response.json()
                logger.error(f"Authentifizierungsfehler: {result}")
                return {
                    'success': False,
                    'error': f"Authentifizierungsfehler: {result.get('message', 'Token ungültig oder abgelaufen')}"
                }
            elif response.status_code == 429:
                result = response.json()
                retry_after = result.get('retryAfter', 3600)
                logger.error(f"Rate Limit erreicht: {result}")
                return {
                    'success': False,
                    'error': f"Rate Limit erreicht. Retry nach {retry_after} Sekunden.",
                    'retry_after': retry_after
                }
            else:
                logger.error(f"API Fehler {response.status_code}: {response.text}")
                return {
                    'success': False,
                    'error': f"API Fehler {response.status_code}: {response.text}"
                }
            
        except ValueError as e:
            # Token-Probleme
            logger.error(f"Token-Fehler bei Sofortmeldung {sofortmeldung.id}: {str(e)}")
            return {
                'success': False,
                'error': f"Authentifizierungsfehler: {str(e)}",
                'message': 'Token-Problem bei der API-Kommunikation'
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"API-Fehler bei Sofortmeldung {sofortmeldung.id}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Fehler bei der Übermittlung zur Sofortmelder API'
            }
        except Exception as e:
            logger.error(f"Unerwarteter Fehler bei Sofortmeldung {sofortmeldung.id}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Unerwarteter Fehler bei der Verarbeitung'
            }
    
    def cancel_sofortmeldung(self, sofortmeldung: Sofortmeldung):
        """
        Storniert eine Sofortmeldung über die API
        
        Args:
            sofortmeldung: Das Sofortmeldung-Model-Objekt mit TAN
            
        Returns:
            dict: API-Response
        """
        if not sofortmeldung.tan:
            return {
                'success': False,
                'error': 'Keine TAN vorhanden für Stornierung'
            }
        
        try:
            # Payload für Stornierung
            payload = self._prepare_payload(sofortmeldung)
            payload['tan'] = sofortmeldung.tan  # TAN für Stornierung hinzufügen
            
            response = self.make_authenticated_request(
                'POST',
                '/v1/sofortmeldung/cancel',
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('status') == 200 and result.get('type') == 'success':
                    logger.info(f"Sofortmeldung {sofortmeldung.tan} erfolgreich storniert")
                    return {
                        'success': True,
                        'message': 'Sofortmeldung erfolgreich storniert'
                    }
                    
            logger.error(f"Stornierung fehlgeschlagen: {response.text}")
            return {
                'success': False,
                'error': f"Stornierung fehlgeschlagen: {response.text}"
            }
            
        except Exception as e:
            logger.error(f"Fehler bei Stornierung: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def check_sofortmeldung(self, sofortmeldung: Sofortmeldung):
        """
        Prüft eine Sofortmeldung über die API
        
        Args:
            sofortmeldung: Das Sofortmeldung-Model-Objekt
            
        Returns:
            dict: API-Response mit Prüfungsergebnis
        """
        try:
            payload = self._prepare_payload(sofortmeldung)
            
            response = self.make_authenticated_request(
                'POST',
                '/v1/sofortmeldung/check',
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'data': result.get('data', {}),
                    'notification': result.get('notification', {})
                }
                
            logger.error(f"Check fehlgeschlagen: {response.text}")
            return {
                'success': False,
                'error': f"Check fehlgeschlagen: {response.text}"
            }
            
        except Exception as e:
            logger.error(f"Fehler bei Check: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _prepare_payload(self, sofortmeldung: Sofortmeldung):
        """
        Bereitet die Payload für die API vor (basierend auf echter API-Spec)
        
        Args:
            sofortmeldung: Das Sofortmeldung-Model-Objekt
            
        Returns:
            dict: API-Payload im korrekten Format
        """
        return {
            "companyNumber": sofortmeldung.companyNumber or self.company_number,
            "employee": {
                "firstName": sofortmeldung.first_name,
                "lastName": sofortmeldung.last_name,
                "insuranceNumber": sofortmeldung.insurance_number,
                "citizenship": int(sofortmeldung.citizenship) if sofortmeldung.citizenship else 154,  # Default Deutschland
                "group": int(sofortmeldung.group) if sofortmeldung.group else 101,  # Default Gruppe
                "startDate": sofortmeldung.start_date.strftime("%d.%m.%Y"),  # Format: DD.MM.YYYY
                "employeeBirth": {
                    "land": sofortmeldung.birth_land or "000",
                    "gender": sofortmeldung.birth_gender or "M",
                    "name": sofortmeldung.birth_name or sofortmeldung.first_name,
                    "date": sofortmeldung.birth_date.strftime("%d.%m.%Y") if sofortmeldung.birth_date else "",
                    "place": sofortmeldung.birth_place or ""
                },
                "employeeAddress": {
                    "countryCode": sofortmeldung.country_code or "D",
                    "cityName": sofortmeldung.city_name or "",
                    "zipCode": sofortmeldung.zip_code or "",
                    "streetName": sofortmeldung.street_name or ""
                }
            }
        }
    
    def _extract_validation_errors(self, errors):
        """
        Extrahiert Validierungsfehler aus der API-Response
        
        Args:
            errors: Errors-Dict aus der API-Response
            
        Returns:
            list: Liste der Fehlermeldungen
        """
        error_messages = []
        
        def extract_recursive(obj, path=""):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    current_path = f"{path}.{key}" if path else key
                    extract_recursive(value, current_path)
            elif isinstance(obj, list):
                for item in obj:
                    if isinstance(item, str):
                        error_messages.append(f"{path}: {item}")
                    else:
                        extract_recursive(item, path)
        
        extract_recursive(errors)
        return error_messages

    def check_status(self, tan: str):
        """
        Legacy-Methode für Kompatibilität mit bestehenden Tasks
        """
        # Da die API keinen separaten Status-Endpunkt hat,
        # verwenden wir den check-Endpunkt oder geben einen Placeholder zurück
        return {
            'success': True,
            'status': 'unknown',
            'message': 'Status-Check über check-Endpunkt implementieren'
        }
