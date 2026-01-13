# blink_integration/services.py
import requests
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

class BlinkAPIService:
    """
    Sichere Blink API Integration über Django Backend
    """
    
    def __init__(self):
        # Credentials aus Django Settings (sicher)
        self.api_base = getattr(settings, 'BLINK_API_BASE', 'https://bogdol-api.blink.online')
        self.username = getattr(settings, 'BLINK_USERNAME', None)
        self.password = getattr(settings, 'BLINK_PASSWORD', None)
        
        if not self.username or not self.password:
            raise ValueError("Blink API Credentials nicht in settings.py konfiguriert")
        
        self.auth_token = None
        self.session = requests.Session()
        self.session.timeout = 30
        
    def authenticate(self) -> bool:
        """Authentifizierung mit Blink API basierend auf offizieller Dokumentation"""
        try:
            auth_url = f"{self.api_base}/api/v2/auth"
            
            # Korrekter Payload basierend auf funktionierender Frontend-Implementierung
            auth_data = {
                "AuthMode": "Pwd", 
                "Username": self.username,
                "Password": self.password,
                "Device": {
                    "Number": "bogdol",
                    "Type": "AzureFunction",  # Basierend auf funktionierender Frontend-Implementierung
                    "DeviceInfo": "bogdol"
                }
            }
            
            # Headers für die Authentifizierung
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json;odata.metadata=minimal;odata.streaming=true"
            }
            
            logger.info(f"🔐 Attempting Blink authentication with URL: {auth_url}")
            logger.info(f"🔐 Username: {self.username}")
            logger.info(f"🔐 Headers: {headers}")
            logger.info(f"🔐 Auth payload: {auth_data}")
            
            response = self.session.post(auth_url, json=auth_data, headers=headers)
            
            logger.info(f"🔐 Response status: {response.status_code}")
            logger.info(f"🔐 Response headers: {dict(response.headers)}")
            
            # Immer die Response loggen, auch bei Fehlern
            try:
                response_data = response.json()
                logger.info(f"🔐 Response body: {response_data}")
            except:
                logger.info(f"🔐 Response text (not JSON): {response.text[:1000]}")
            
            # Bei 403 detaillierte Fehlermeldung
            if response.status_code == 403:
                logger.error("❌ 403 Forbidden - Login/Password incorrect oder Authentication Problem")
                return False
            
            response.raise_for_status()
            
            data = response.json()
            
            # Das Frontend verwendet id_token (kleingeschrieben), probiere beide Varianten
            if 'id_token' in data:  # Frontend-Variante
                self.auth_token = data['id_token']
                cache.set('blink_auth_token', self.auth_token, 1800)
                logger.info("✅ Blink API Authentifizierung erfolgreich (id_token)")
                return True
            elif 'IdToken' in data:  # API-Dokumentations-Variante
                self.auth_token = data['IdToken']
                cache.set('blink_auth_token', self.auth_token, 1800)
                logger.info("✅ Blink API Authentifizierung erfolgreich (IdToken)")
                logger.info(f"✅ Token Type: {data.get('TokenType', 'Unknown')}")
                return True
            else:
                logger.error(f"❌ Kein Token in Blink API Response. Verfügbare Felder: {list(data.keys())}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Blink API Authentifizierung fehlgeschlagen: {e}")
            return False
    
    def ensure_authenticated(self) -> bool:
        """Stelle sicher, dass wir authentifiziert sind"""
        # Prüfe Cache
        cached_token = cache.get('blink_auth_token')
        if cached_token:
            self.auth_token = cached_token
            return True
        
        # Neue Authentifizierung
        return self.authenticate()
    
    def get_headers(self) -> Dict[str, str]:
        """Standard Headers mit Auth Token"""
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        if self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        return headers
    
    def fetch_service_managers(self, user_blink_company: int, user_blink_id: Optional[int] = None) -> List[Dict]:
        """
        Lade Service Manager basierend auf User-Konfiguration
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # URL basierend auf Company konfigurieren
            if user_blink_company == 1:
                permission_group = 7  # SERVICEMANAGER
            elif user_blink_company == 7:
                permission_group = 32  # COMPANY_7_GROUP
            else:
                raise ValueError(f"Unsupported company: {user_blink_company}")
            
            # OData URL aufbauen
            base_url = f"{self.api_base}/odata/v2/CompanyPermissionGroups"
            expand = "LoginUsers($select=Id,FirstName,LastName;$filter=Active eq true"
            
            # Wenn User-ID vorhanden, nur diese User laden
            if user_blink_id:
                expand += f" and Id eq {user_blink_id}"
            
            expand += ")"
            filter_clause = f"CompanyId eq {user_blink_company} and Id eq {permission_group}"
            select = "Name"
            
            url = f"{base_url}?$expand={expand}&$filter={filter_clause}&$select={select}"
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            login_users = data.get('value', [{}])[0].get('LoginUsers', [])
            
            # Formatiere die Daten
            managers = []
            for user in login_users:
                managers.append({
                    'id': user.get('Id'),
                    'firstName': user.get('FirstName', ''),
                    'lastName': user.get('LastName', ''),
                    'fullName': f"{user.get('FirstName', '')} {user.get('LastName', '')}".strip()
                })
            
            logger.info(f"Loaded {len(managers)} service managers for company {user_blink_company}")
            return managers
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Service Manager: {e}")
            raise
    
    def get_service_managers_with_locations(self, user_blink_company: int = None, user_blink_id: int = None) -> List[Dict]:
        """
        Lade Service Manager mit ihren Locations (wie im funktionierenden Frontend)
        Arbeitet ohne $expand, lädt Locations separat und ordnet über userId zu
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # Schritt 1: Hole alle Employees (ohne $expand)
            endpoint = "odata/v3/Employees"
            expected_fields = ["Id", "LoginUserId", "FirstName", "LastName"]
            safe_fields = self.discover_fields(endpoint, expected_fields)
            
            base_url = f"{self.api_base}/{endpoint}"
            
            if len(safe_fields) > 1:
                select_clause = ",".join(safe_fields)
                url = f"{base_url}?$select={select_clause}"
            else:
                url = base_url
            
            logger.info(f"🔍 Employees URL: {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            employees = data.get('value', [])
            
            logger.info(f"📋 Loaded {len(employees)} employees")
            
            # Schritt 2: Hole alle Locations separat
            locations = self.fetch_locations(user_blink_company)
            logger.info(f"📍 Loaded {len(locations)} locations")
            
            # Schritt 3: Gruppiere Locations nach userId (wie Frontend)
            managers = []
            location_by_user = {}
            
            for location in locations:
                user_id = location.get('userId')
                if user_id:
                    if user_id not in location_by_user:
                        location_by_user[user_id] = []
                    location_by_user[user_id].append(location)
            
            logger.info(f"👥 Found {len(location_by_user)} users with managed locations")
            
            # Schritt 4: Erstelle Manager-Liste basierend auf Employees die Locations haben
            for employee in employees:
                login_user_id = employee.get('LoginUserId')
                if login_user_id and login_user_id in location_by_user:
                    # Dieser Employee ist ein Manager (hat Locations)
                    employee_locations = location_by_user[login_user_id]
                    
                    managers.append({
                        'id': login_user_id,  # Verwende LoginUserId als ID (wie Frontend)
                        'firstName': employee.get('FirstName', ''),
                        'lastName': employee.get('LastName', ''),
                        'fullName': f"{employee.get('FirstName', '')} {employee.get('LastName', '')}".strip(),
                        'locations': employee_locations
                    })
            
            logger.info(f"✅ Created {len(managers)} managers with locations")
            
            # Debug: Zeige erste Manager Details
            for i, manager in enumerate(managers[:3]):
                logger.info(f"👤 Manager {i+1}: {manager['fullName']} ({manager['id']}) - {len(manager['locations'])} Locations")
            
            return managers
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Manager mit Locations: {e}")
            raise
    
    def fetch_worklogs(self, start_date: date, end_date: date, user_blink_company: int) -> List[Dict]:
        """
        Lade Worklog-Daten für den Zeitraum mit Field Discovery
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            endpoint = "odata/v3/Worklogs"
            expected_fields = ["Id", "Date", "LoginUserId", "EmployeeId", "LocationId", "TotalMinutes", "Status", "IsExported", 
                             "UserId", "Location", "Minutes", "StatusId", "Exported", "CompanyId", "WorkedDuration", "PlannedDuration"]
            safe_fields = self.discover_fields(endpoint, expected_fields)
            
            base_url = f"{self.api_base}/{endpoint}"
            
            # Verwende einfache Abfrage mit Datum-Filter
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            if len(safe_fields) > 1:
                select_clause = ",".join(safe_fields)
                url = f"{base_url}?$filter=Date%20ge%20{start_str}%20and%20Date%20le%20{end_str}&$select={select_clause}&$top=200"
            else:
                url = f"{base_url}?$filter=Date%20ge%20{start_str}%20and%20Date%20le%20{end_str}&$top=200"
            
            logger.info(f"🔍 Worklogs URL: {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            
            if response.status_code != 200:
                logger.error(f"🔍 Date filter failed: {response.text[:500]}")
                
                # Fallback: Ohne Datum-Filter
                if len(safe_fields) > 1:
                    select_clause = ",".join(safe_fields)
                    fallback_url = f"{base_url}?$select={select_clause}&$top=50"
                else:
                    fallback_url = f"{base_url}?$top=50"
                
                logger.info(f"🔍 Fallback URL: {fallback_url}")
                response = self.session.get(fallback_url, headers=self.get_headers())
            
            response.raise_for_status()
            
            data = response.json()
            all_worklogs = data.get('value', [])
            
            # Filter manuell nach Datum und Company
            filtered_worklogs = []
            for worklog in all_worklogs:
                # Prüfe Company
                company_id = worklog.get('CompanyId') or worklog.get('companyId')
                if company_id and company_id != user_blink_company:
                    continue
                
                # Prüfe Datum
                worklog_date_str = worklog.get('Date', '')
                if worklog_date_str:
                    try:
                        if 'T' in worklog_date_str:
                            worklog_date = datetime.fromisoformat(worklog_date_str.replace('Z', '+00:00')).date()
                        else:
                            worklog_date = datetime.strptime(worklog_date_str[:10], '%Y-%m-%d').date()
                        
                        if start_date <= worklog_date <= end_date:
                            filtered_worklogs.append(worklog)
                    except:
                        continue
                else:
                    # Wenn kein Datum, trotzdem aufnehmen
                    filtered_worklogs.append(worklog)
            
            logger.info(f"✅ Loaded {len(filtered_worklogs)} worklogs for company {user_blink_company}, period {start_date} to {end_date}")
            return filtered_worklogs
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Worklogs: {e}")
            raise
    
    def discover_fields(self, endpoint: str, expected_fields: List[str]) -> List[str]:
        """
        Entdecke verfügbare Felder für einen OData-Endpunkt
        """
        try:
            discovery_url = f"{self.api_base}/{endpoint}?$top=1"
            logger.info(f"🔍 Discovering fields for {endpoint}: {discovery_url}")
            
            response = self.session.get(discovery_url, headers=self.get_headers())
            if response.status_code == 200:
                data = response.json()
                sample_entry = data.get('value', [])
                
                if sample_entry:
                    available_fields = list(sample_entry[0].keys())
                    logger.info(f"🔍 Available fields in {endpoint}: {available_fields}")
                    
                    # Verwende nur verfügbare Felder
                    safe_fields = []
                    for field in expected_fields:
                        if field in available_fields:
                            safe_fields.append(field)
                    
                    logger.info(f"🔍 Safe fields for {endpoint}: {safe_fields}")
                    return safe_fields
            
            logger.warning(f"🔍 Discovery failed for {endpoint}, using minimal fields")
            return ["Id"]  # Fallback zu minimalem Feld
            
        except Exception as e:
            logger.error(f"🔍 Discovery error for {endpoint}: {e}")
            return ["Id"]  # Fallback

    def fetch_locations(self, user_blink_company: int) -> List[Dict]:
        """
        Lade Locations für die Company mit Field Discovery
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            endpoint = "odata/v2/Locations"
            expected_fields = ["Id", "Name", "Address", "City", "CompanyId", "Active", "IsActive"]
            safe_fields = self.discover_fields(endpoint, expected_fields)
            
            base_url = f"{self.api_base}/{endpoint}"
            
            # Verwende einfache Abfrage mit $top falls Filter nicht funktioniert
            if len(safe_fields) > 1:
                select_clause = ",".join(safe_fields)
                url = f"{base_url}?$select={select_clause}&$top=100"
            else:
                url = f"{base_url}?$top=100"
            
            logger.info(f"🔍 Locations URL: {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            all_locations = data.get('value', [])
            
            # Filter manuell nach Company (falls CompanyId Feld vorhanden)
            locations = []
            for loc in all_locations:
                company_id = loc.get('CompanyId') or loc.get('companyId')
                is_active = loc.get('Active') or loc.get('IsActive') or loc.get('active')
                
                if company_id == user_blink_company and is_active is not False:
                    locations.append(loc)
            
            logger.info(f"✅ Loaded {len(locations)} locations for company {user_blink_company}")
            return locations
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Locations: {e}")
            raise

    def fetch_manager_locations_mapping(self, user_blink_company: int) -> Dict:
        """
        Lade die Zuordnung zwischen Service Managern und ihren verwalteten Locations
        (Wie im alten Frontend über Employees->ManagedLocations)
        """
        if not self.ensure_authenticated():
            raise Exception("Blink API Authentifizierung fehlgeschlagen")
        
        try:
            # Verwende den gleichen Endpunkt wie das alte Frontend
            url = f"{self.api_base}/odata/v2/Employees?$expand=ManagedLocations($select=Id,Name,ObjectNumber;$filter=IsActive eq true),Areas($select=Name)&$select=LoginUserId"
            
            logger.info(f"🔍 Manager-Locations-Mapping URL: {url}")
            
            response = self.session.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            employees = data.get('value', [])
            
            # Mapping erstellen: LoginUserId -> ManagedLocations
            manager_locations_map = {}
            
            for employee in employees:
                login_user_id = employee.get('LoginUserId')
                managed_locations = employee.get('ManagedLocations', [])
                areas = employee.get('Areas', [])
                
                if login_user_id and managed_locations:
                    manager_locations_map[login_user_id] = {
                        'locations': [
                            {
                                'id': loc.get('Id'),
                                'name': loc.get('Name'),
                                'objectNumber': loc.get('ObjectNumber')
                            }
                            for loc in managed_locations
                        ],
                        'areas': [{'name': area.get('Name')} for area in areas]
                    }
            
            logger.info(f"✅ Loaded location mapping for {len(manager_locations_map)} managers")
            
            # Debug: Zeige LoginUser IDs aus Employees
            employee_login_ids = list(manager_locations_map.keys())
            logger.info(f"� Employee LoginUser IDs: {employee_login_ids[:10]}")
            
            return manager_locations_map
            
        except Exception as e:
            logger.error(f"Fehler beim Laden des Manager-Location-Mappings: {e}")
            raise
