import requests
import logging
from datetime import date, datetime
from typing import List, Dict, Tuple, Optional
import time

logger = logging.getLogger(__name__)

class BlinkAPIService:
    def __init__(self):
        self.api_base = "https://bogdol-api.blink.online"
        self.auth_token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json;odata.metadata=minimal;odata.streaming=true',
            'Content-Type': 'application/json'
        })
        
        # Field Discovery Cache
        self.field_cache = {}
        
        logger.info("BlinkAPIService initialisiert")

    def authenticate(self, username: str, password: str) -> bool:
        """
        Authentifizierung mit der Blink API
        """
        auth_url = f"{self.api_base}/api/v2/auth"
        
        payload = {
            "AuthMode": "Pwd",
            "Username": username,
            "Password": password,
            "Device": {
                "Number": "bogdol",
                "Type": "AzureFunction", 
                "DeviceInfo": "bogdol"
            }
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json;odata.metadata=minimal;odata.streaming=true'
        }
        
        logger.info(f"🔐 Attempting Blink authentication with URL: {auth_url}")
        logger.info(f"🔐 Username: {username}")
        logger.info(f"🔐 Headers: {headers}")
        logger.info(f"🔐 Auth payload: {payload}")
        
        try:
            response = requests.post(auth_url, json=payload, headers=headers)
            
            logger.info(f"🔐 Response status: {response.status_code}")
            logger.info(f"🔐 Response headers: {dict(response.headers)}")
            logger.info(f"🔐 Response body: {response.json()}")
            
            if response.status_code == 200:
                auth_data = response.json()
                self.auth_token = auth_data.get('id_token')
                
                if self.auth_token:
                    logger.info("✅ Blink API Authentifizierung erfolgreich (id_token)")
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}'
                    })
                    return True
                else:
                    logger.error("❌ Kein Token in der Antwort erhalten")
                    return False
            else:
                logger.error(f"❌ Authentifizierung fehlgeschlagen: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Authentifizierungsfehler: {e}")
            return False

    def ensure_authenticated(self) -> bool:
        """
        Stelle sicher, dass wir authentifiziert sind
        """
        if not self.auth_token:
            # Verwende Standard-Anmeldedaten für Tests
            return self.authenticate(
                username="p.offermanns@bogdol-dienstleistungen.de",
                password="Joni#3487"
            )
        return True

    def get_headers(self) -> Dict[str, str]:
        """
        Erstelle Header für API-Aufrufe
        """
        return {
            'Authorization': f'Bearer {self.auth_token}',
            'Accept': 'application/json;odata.metadata=minimal;odata.streaming=true',
            'Content-Type': 'application/json'
        }

    def get_service_managers_with_locations(self, user_blink_company: int = None, user_blink_id: int = None) -> List[Dict]:
        """
        Lade Service Manager mit ihren Locations GENAU wie im funktionierenden Frontend
        Verwendet odata/v2/Employees mit $expand=ManagedLocations
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # GENAU wie Frontend: odata/v2/Employees mit ManagedLocations
            url = "https://bogdol-api.blink.online/odata/v2/Employees?$expand=ManagedLocations(%24select%3DId%2CName%2CObjectNumber%3B%24filter%3DIsActive%20eq%20true),Areas(%24select%3DName)&$select=LoginUserId"
            
            logger.info(f"🔍 Frontend-URL kopiert: {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            employees = data.get('value', [])
            
            logger.info(f"📥 Received {len(employees)} employees from v2 API")
            
            # Genau wie Frontend: Locations sammeln und Manager erstellen
            managers = []
            all_locations = []
            
            for employee in employees:
                login_user_id = employee.get('LoginUserId')
                managed_locations = employee.get('ManagedLocations', [])
                areas = employee.get('Areas', [])
                
                if login_user_id and managed_locations:  # Nur Employees mit Locations sind Manager
                    # Areas verarbeiten wie Frontend
                    areas_formatted = [{'name': area.get('Name', '')} for area in areas]
                    
                    # Locations für diesen Manager sammeln
                    manager_locations = []
                    for loc in managed_locations:
                        location_data = {
                            'id': loc.get('Id'),
                            'name': loc.get('Name', ''),
                            'objectNumber': loc.get('ObjectNumber', ''),
                            'userId': login_user_id,  # Frontend verwendet LoginUserId
                            'areas': areas_formatted
                        }
                        manager_locations.append(location_data)
                        all_locations.append(location_data)
                    
                    # Manager erstellen (Namen werden später über CompanyPermissionGroups geholt)
                    managers.append({
                        'id': login_user_id,
                        'firstName': 'Unknown',
                        'lastName': 'Manager',
                        'fullName': f'Manager {login_user_id}',
                        'locations': manager_locations
                    })
            
            logger.info(f"👥 Found {len(managers)} managers with {len(all_locations)} total locations")
            
            # Jetzt Manager-Namen aus CompanyPermissionGroups laden (falls verfügbar)
            try:
                service_manager_details = self.fetch_service_managers(
                    user_blink_company=user_blink_company,
                    user_blink_id=user_blink_id
                )
                
                # Namen zuordnen
                for manager in managers:
                    for detail in service_manager_details:
                        if detail['id'] == manager['id']:
                            manager['firstName'] = detail['firstName']
                            manager['lastName'] = detail['lastName']
                            manager['fullName'] = detail['fullName']
                            break
                            
                logger.info(f"✅ Updated {len([m for m in managers if m['firstName'] != 'Unknown'])} manager names")
                
            except Exception as e:
                logger.warning(f"⚠️ Could not load manager names from CompanyPermissionGroups: {e}")
            
            # Debug: Zeige erste Manager Details
            for i, manager in enumerate(managers[:3]):
                logger.info(f"👤 Manager {i+1}: {manager['fullName']} ({manager['id']}) - {len(manager['locations'])} Locations")
            
            return managers
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Manager mit Locations: {e}")
            raise

    def fetch_service_managers(self, user_blink_company: int = None, user_blink_id: int = None) -> List[Dict]:
        """
        Lade Service Manager aus CompanyPermissionGroups (für Namen)
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            url = f"{self.api_base}/odata/v3/CompanyPermissionGroups"
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            groups = data.get('value', [])
            
            managers = []
            for group in groups:
                login_users = group.get('LoginUsers', [])
                for user in login_users:
                    user_id = user.get('Id')
                    first_name = user.get('FirstName', '')
                    last_name = user.get('LastName', '')
                    
                    if user_id:
                        managers.append({
                            'id': user_id,
                            'firstName': first_name,
                            'lastName': last_name,
                            'fullName': f"{first_name} {last_name}".strip()
                        })
            
            logger.info(f"Loaded {len(managers)} service managers from permission groups")
            return managers
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Service Manager: {e}")
            return []

    def fetch_worklogs(self, start_date: date, end_date: date, user_blink_company: int) -> List[Dict]:
        """
        Lade Worklog-Daten für den Zeitraum
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            url = f"{self.api_base}/odata/v3/Worklogs"
            
            # Verwende einfache Abfrage mit Datum-Filter
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            filter_url = f"{url}?$filter=Date%20ge%20{start_str}%20and%20Date%20le%20{end_str}&$top=200"
            
            logger.info(f"🔍 Worklogs URL: {filter_url}")
            
            response = self.session.get(filter_url, headers=self.get_headers())
            
            if response.status_code != 200:
                logger.error(f"🔍 Date filter failed: {response.text[:500]}")
                # Fallback: Ohne Datum-Filter
                response = self.session.get(f"{url}?$top=200", headers=self.get_headers())
            
            response.raise_for_status()
            
            data = response.json()
            worklogs = data.get('value', [])
            
            logger.info(f"📊 Loaded {len(worklogs)} worklogs for period {start_date} to {end_date}")
            
            return worklogs
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Worklogs: {e}")
            raise

    def fetch_locations(self, user_blink_company: int) -> List[Dict]:
        """
        Lade alle Locations
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            url = f"{self.api_base}/odata/v3/Locations"
            
            logger.info(f"🔍 Locations URL: {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            locations = data.get('value', [])
            
            logger.info(f"📍 Loaded {len(locations)} locations")
            
            return locations
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Locations: {e}")
            raise
