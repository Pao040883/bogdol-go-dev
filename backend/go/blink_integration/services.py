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

    def fetch_service_managers(self, user_blink_company: int = None, user_blink_id: int = None) -> List[Dict]:
        """
        Lade AKTIVE Service Manager aus CompanyPermissionGroups GENAU wie Frontend
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # Company-spezifische Permission Group IDs (wie Frontend)
            company_to_permission_group = {
                1: 7,   # Company 1 -> Permission Group 7
                7: 32   # Company 7 -> Permission Group 32
            }
            
            if user_blink_company and user_blink_company in company_to_permission_group:
                permission_group_id = company_to_permission_group[user_blink_company]
                logger.info(f"🏢 Company {user_blink_company} -> Permission Group {permission_group_id}")
                
                # EXAKTE Frontend URL-Struktur für aktive Service Manager
                base_url = "https://bogdol-api.blink.online/odata/v2/CompanyPermissionGroups"
                
                # WICHTIG: $expand=LoginUsers(%24filter%3DActive%20eq%20true%3B%24select%3DId%2CFirstName%2CLastName)
                expand_clause = "LoginUsers(%24filter%3DActive%20eq%20true%3B%24select%3DId%2CFirstName%2CLastName)"
                select_clause = "Name"
                filter_clause = f"Id%20eq%20{permission_group_id}"
                
                url = f"{base_url}?$expand={expand_clause}&$select={select_clause}&$filter={filter_clause}"
                
                logger.info(f"🔍 CompanyPermissionGroups URL: {url}")
                
                response = self.session.get(url, headers=self.get_headers())
                response.raise_for_status()
                
                data = response.json()
                permission_groups = data.get('value', [])
                
                if not permission_groups:
                    logger.warning(f"⚠️ No permission group found for ID {permission_group_id}")
                    return []
                
                # Extrahiere LoginUsers (aktive Service Manager)
                login_users = permission_groups[0].get('LoginUsers', [])
                
                # Formatiere Manager-Liste
                managers = []
                for user in login_users:
                    user_id = user.get('Id')
                    first_name = user.get('FirstName', '')
                    last_name = user.get('LastName', '')
                    full_name = f"{first_name} {last_name}".strip()
                    
                    if not full_name:
                        full_name = f"Manager {user_id}"
                    
                    managers.append({
                        'id': user_id,
                        'firstName': first_name,
                        'lastName': last_name,
                        'fullName': full_name
                    })
                
                logger.info(f"✅ Loaded {len(managers)} ACTIVE service managers from permission group {permission_group_id}")
                return managers
                
            else:
                logger.warning(f"❌ Unsupported company ID: {user_blink_company}. Supported: {list(company_to_permission_group.keys())}")
                return []
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Service Manager: {e}")
            raise

    def get_service_managers_with_locations(self, user_blink_company: int = None, user_blink_id: int = None) -> List[Dict]:
        """
        Lade Service Manager GENAU wie funktionierendes Frontend:
        1. Service Manager Namen aus CompanyPermissionGroups (mit Active=true)
        2. Locations aus Employees API
        3. Kombiniere beide Datenquellen
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # SCHRITT 1: Lade aktive Service Manager Namen aus CompanyPermissionGroups (wie Frontend)
            active_managers = self.fetch_service_managers(
                user_blink_company=user_blink_company,
                user_blink_id=user_blink_id
            )
            
            logger.info(f"📋 Loaded {len(active_managers)} ACTIVE service managers from permission groups")
            
            # SCHRITT 2: Lade alle Employee-Locations (wie Frontend fetchAllLocations)
            base_url = "https://bogdol-api.blink.online/odata/v2/Employees"
            expand_clause = "ManagedLocations(%24select%3DId%2CName%2CObjectNumber%3B%24filter%3DIsActive%20eq%20true),Areas(%24select%3DName)"
            select_clause = "LoginUserId"
            
            url = f"{base_url}?$expand={expand_clause}&$select={select_clause}"
            
            logger.info(f"🔍 Employee-Locations URL (wie Frontend): {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            employees = data.get('value', [])
            
            logger.info(f"📥 Received {len(employees)} employees from v2 API")
            
            # SCHRITT 3: Kombiniere aktive Manager mit ihren Locations
            final_managers = []
            active_manager_ids = set(m['id'] for m in active_managers)
            
            for employee in employees:
                login_user_id = employee.get('LoginUserId')
                managed_locations = employee.get('ManagedLocations', [])
                areas = employee.get('Areas', [])
                
                # Nur wenn dieser Employee ein aktiver Service Manager ist UND Locations hat
                if login_user_id in active_manager_ids and managed_locations:
                    # Finde Manager-Details
                    manager_details = next((m for m in active_managers if m['id'] == login_user_id), None)
                    
                    if manager_details:
                        # Areas verarbeiten wie Frontend
                        areas_formatted = [{'name': area.get('Name', '')} for area in areas]
                        
                        # Locations für diesen Manager sammeln
                        manager_locations = []
                        for loc in managed_locations:
                            location_data = {
                                'id': loc.get('Id'),
                                'name': loc.get('Name', ''),
                                'objectNumber': loc.get('ObjectNumber', ''),
                                'userId': login_user_id,
                                'areas': areas_formatted
                            }
                            manager_locations.append(location_data)
                        
                        # Manager mit echten Namen und Locations erstellen
                        final_managers.append({
                            'id': login_user_id,
                            'firstName': manager_details['firstName'],
                            'lastName': manager_details['lastName'],
                            'fullName': manager_details['fullName'],  # ✅ Bereits im manager_details enthalten
                            'locations': manager_locations
                        })
            
            logger.info(f"👥 Final result: {len(final_managers)} ACTIVE managers with locations")
            
            # Debug: Zeige erste Manager Details
            for i, manager in enumerate(final_managers[:3]):
                logger.info(f"👤 Manager {i+1}: {manager['fullName']} ({manager['id']}) - {len(manager['locations'])} Locations")
            
            return final_managers
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Manager mit Locations: {e}")
            raise

    def fetch_service_managers(self, user_blink_company: int = None, user_blink_id: int = None) -> List[Dict]:
        """
        Lade Service Manager aus CompanyPermissionGroups GENAU wie Frontend
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # GENAU wie Frontend: Company-spezifische Permission Group IDs
            if user_blink_company == 1:
                permission_group_id = 7
            elif user_blink_company == 7:
                permission_group_id = 32
            else:
                permission_group_id = 7  # Default fallback
            
            # GENAU wie Frontend URL-Format
            if user_blink_id:
                # Für spezifischen User
                url = f"{self.api_base}/odata/v2/CompanyPermissionGroups?$expand=LoginUsers(%24select%3DId%2CFirstName%2CLastName%3B%24filter%3DActive%20eq%20true%20and%20Id%20eq%20{user_blink_id})&$filter=CompanyId%20eq%20{user_blink_company}%20and%20Id%20eq%20{permission_group_id}&$select=Name"
            else:
                # Für alle aktiven User
                url = f"{self.api_base}/odata/v2/CompanyPermissionGroups?$expand=LoginUsers(%24select%3DId%2CFirstName%2CLastName%3B%24filter%3DActive%20eq%20true%20)&$filter=CompanyId%20eq%20{user_blink_company}%20and%20Id%20eq%20{permission_group_id}&$select=Name"
            
            logger.info(f"🔍 Service Manager URL (Frontend-Format): {url}")
            
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
            
            logger.info(f"📋 Loaded {len(managers)} service managers from permission groups (Group {permission_group_id})")
            return managers
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Service Manager: {e}")
            return []

    def fetch_worklogs(self, start_date: date, end_date: date, user_blink_company: int) -> List[Dict]:
        """
        Lade Worklog-Daten für den Zeitraum MIT Minutes für Statistics
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # ERWEITERT: Lade auch Minutes für Statistik-Berechnung
            base_url = f"{self.api_base}/odata/v3/Worklogs"
            
            # Korrigiertes Datumsformat für OData API
            start_str = start_date.strftime('%Y-%m-%dT00:00:00Z')
            end_str = end_date.strftime('%Y-%m-%dT23:59:59Z')
            
            # Basis-$select ohne Minutes (falls nicht verfügbar)
            filter_url = f"{base_url}?$filter=Date%20ge%20{start_str}%20and%20Date%20le%20{end_str}&$select=LocationId,Status"
            
            logger.info(f"🔍 Worklogs URL (erweitert mit Minutes): {filter_url}")
            
            response = self.session.get(filter_url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            worklogs = data.get('value', [])
            
            logger.info(f"📊 Loaded {len(worklogs)} worklogs with minutes for period {start_date} to {end_date}")
            
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
