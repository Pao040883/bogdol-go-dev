# sofortmeldung/management/commands/test_sofortmelder_api.py
from django.core.management.base import BaseCommand
from django.conf import settings
from sofortmeldung.services import SofortmelderAPIService
import json
import requests

class Command(BaseCommand):
    help = 'Testet die Sofortmelder.de API Verbindung und Authentifizierung'

    def add_arguments(self, parser):
        parser.add_argument(
            '--test-auth',
            action='store_true',
            help='Testet nur die Authentifizierung',
        )
        parser.add_argument(
            '--test-create',
            action='store_true',
            help='Testet das Erstellen einer Test-Sofortmeldung',
        )
        parser.add_argument(
            '--test-status',
            type=str,
            help='Testet Status-Abfrage mit gegebener TAN',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Zeigt nur was gesendet werden würde (ohne echte API-Calls)',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🧪 Starte API-Tests für Sofortmelder.de...')
        )
        
        # API Service initialisieren
        try:
            api_service = SofortmelderAPIService()
            self.stdout.write(
                self.style.SUCCESS('✅ API Service erfolgreich initialisiert')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Fehler beim Initialisieren des API Service: {e}')
            )
            return

        # Konfiguration prüfen
        self.check_configuration()

        if options['test_auth']:
            self.test_authentication(api_service, options['dry_run'])
        elif options['test_create']:
            self.test_create_sofortmeldung(api_service, options['dry_run'])
        elif options['test_status']:
            self.test_status_check(api_service, options['test_status'], options['dry_run'])
        else:
            self.show_test_options()

    def check_configuration(self):
        """Prüft die API-Konfiguration"""
        self.stdout.write("\n🔧 API-Konfiguration:")
        
        api_url = getattr(settings, 'SOFORTMELDER_API_URL', 'Nicht konfiguriert')
        refresh_token = '***' if getattr(settings, 'SOFORTMELDER_REFRESH_TOKEN', None) else 'Nicht konfiguriert'
        company_number = getattr(settings, 'SOFORTMELDER_COMPANY_NUMBER', 'Nicht konfiguriert')
        
        self.stdout.write(f"   API URL:        {api_url}")
        self.stdout.write(f"   Refresh Token:  {refresh_token}")
        self.stdout.write(f"   Company Number: {company_number}")
        
        # Validierung
        missing = []
        if not hasattr(settings, 'SOFORTMELDER_API_URL'):
            missing.append('SOFORTMELDER_API_URL')
        if not hasattr(settings, 'SOFORTMELDER_REFRESH_TOKEN'):
            missing.append('SOFORTMELDER_REFRESH_TOKEN')
        if not hasattr(settings, 'SOFORTMELDER_COMPANY_NUMBER'):
            missing.append('SOFORTMELDER_COMPANY_NUMBER')
        
        if missing:
            self.stdout.write(
                self.style.ERROR(f"❌ Fehlende Konfiguration: {', '.join(missing)}")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("✅ Alle erforderlichen Konfigurationen vorhanden")
            )

    def test_authentication(self, api_service, dry_run):
        """Testet die Token-Authentifizierung"""
        self.stdout.write("\n🔐 Teste Token-Authentifizierung...")
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 Dry-Run: Würde Token-Refresh testen")
            )
            return
        
        try:
            self.stdout.write("   Teste Token-Refresh...")
            
            # Versuche Access Token zu holen/erneuern
            access_token = api_service.get_access_token()
            
            if access_token:
                # Zeige ersten und letzten Teil des Tokens
                token_preview = f"{access_token[:20]}...{access_token[-20:]}" if len(access_token) > 40 else access_token
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Access Token erfolgreich erhalten: {token_preview}")
                )
                
                # Teste Header-Generierung
                headers = api_service.get_headers()
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Bearer Token Header erfolgreich erstellt")
                )
                
            else:
                self.stdout.write(
                    self.style.ERROR("❌ Kein Access Token erhalten")
                )
                self.stdout.write("   Mögliche Ursachen:")
                self.stdout.write("   - Refresh Token ungültig oder abgelaufen")
                self.stdout.write("   - Netzwerkfehler")
                self.stdout.write("   - API-Server nicht erreichbar")
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Fehler bei Token-Authentifizierung: {e}")
            )

    def test_create_sofortmeldung(self, api_service, dry_run):
        """Testet das Erstellen einer Sofortmeldung"""
        self.stdout.write("\n📋 Teste Sofortmeldung-Erstellung...")
        
        # Test-Daten basierend auf echter API-Spec
        test_data = {
            'companyNumber': getattr(settings, 'SOFORTMELDER_COMPANY_NUMBER', '15308598'),
            'employee': {
                'firstName': 'Max',
                'lastName': 'Mustermann',
                'insuranceNumber': None,  # Kann null sein
                'citizenship': 154,  # Deutschland
                'group': 101,  # Standard-Gruppe
                'startDate': '15.01.2024',  # DD.MM.YYYY Format
                'employeeBirth': {
                    'land': '000',
                    'gender': 'M',
                    'name': 'Max',
                    'date': '22.01.1990',
                    'place': 'Berlin'
                },
                'employeeAddress': {
                    'countryCode': 'D',
                    'cityName': 'Berlin',
                    'zipCode': '10115',
                    'streetName': 'Musterstraße 123'
                }
            }
        }
        
        self.stdout.write("📤 Test-Daten (API-Format):")
        for key, value in test_data.items():
            if isinstance(value, dict):
                self.stdout.write(f"   {key}:")
                for sub_key, sub_value in value.items():
                    if isinstance(sub_value, dict):
                        self.stdout.write(f"     {sub_key}:")
                        for sub_sub_key, sub_sub_value in sub_value.items():
                            self.stdout.write(f"       {sub_sub_key}: {sub_sub_value}")
                    else:
                        self.stdout.write(f"     {sub_key}: {sub_value}")
            else:
                self.stdout.write(f"   {key}: {value}")
        
        if dry_run:
            self.stdout.write("\n📦 Würde folgende Payload senden:")
            self.stdout.write(json.dumps(test_data, indent=2, ensure_ascii=False))
            return
        
        try:
            self.stdout.write("   Sende Erstellungs-Request...")
            
            # Direkter API-Call für Test mit Token-Auth
            response = api_service.make_authenticated_request(
                'POST',
                '/v1/sofortmeldung/create',
                json=test_data,
                timeout=30
            )
            
            self.stdout.write(f"   Response Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                self.stdout.write(f"   Response Body: {json.dumps(result, indent=2, ensure_ascii=False)}")
                
                if result.get('status') == 200 and result.get('type') == 'success':
                    data_section = result.get('data', {})
                    tan = data_section.get('tan')
                    url = data_section.get('url')
                    
                    self.stdout.write(
                        self.style.SUCCESS(f"✅ Sofortmeldung erfolgreich erstellt!")
                    )
                    if tan:
                        self.stdout.write(f"   TAN: {tan}")
                    if url:
                        self.stdout.write(f"   PDF-URL: {url}")
                else:
                    self.stdout.write(
                        self.style.ERROR(f"❌ Unerwartete Response-Struktur: {result}")
                    )
            elif response.status_code == 403:
                result = response.json()
                self.stdout.write(
                    self.style.ERROR(f"❌ Validierungsfehler:")
                )
                self.stdout.write(f"   {json.dumps(result, indent=2, ensure_ascii=False)}")
            elif response.status_code == 401:
                result = response.json()
                self.stdout.write(
                    self.style.ERROR(f"❌ Authentifizierungsfehler (Token-Problem):")
                )
                self.stdout.write(f"   {json.dumps(result, indent=2, ensure_ascii=False)}")
            else:
                self.stdout.write(
                    self.style.ERROR(f"❌ HTTP {response.status_code}: {response.text}")
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Fehler bei Erstellung: {e}")
            )

    def test_status_check(self, api_service, tan, dry_run):
        """Testet die Status-Abfrage"""
        self.stdout.write(f"\n🔍 Teste Status-Abfrage für TAN: {tan}")
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"🔍 Dry-Run: Würde Status für TAN {tan} abfragen")
            )
            return
        
        try:
            self.stdout.write("   Sende Status-Request...")
            result = api_service.check_status(tan)
            
            if result['success']:
                status = result.get('status', 'Unbekannt')
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Status abgerufen: {status}")
                )
                
                # Zusätzliche Details falls vorhanden
                for key in ['message', 'last_updated', 'details']:
                    if key in result:
                        self.stdout.write(f"   {key}: {result[key]}")
            else:
                self.stdout.write(
                    self.style.ERROR(f"❌ Status-Abfrage fehlgeschlagen: {result.get('error', 'Unbekannter Fehler')}")
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Fehler bei Status-Abfrage: {e}")
            )

    def show_test_options(self):
        """Zeigt verfügbare Test-Optionen"""
        self.stdout.write(
            self.style.WARNING(
                '\n🧪 Verfügbare Tests:\n'
                '  --test-auth      : Authentifizierung testen\n'
                '  --test-create    : Sofortmeldung-Erstellung testen\n'
                '  --test-status <TAN> : Status-Abfrage testen\n'
                '  --dry-run        : Simulation ohne echte API-Calls\n'
                '\nBeispiele:\n'
                '  python manage.py test_sofortmelder_api --test-auth\n'
                '  python manage.py test_sofortmelder_api --test-create --dry-run\n'
                '  python manage.py test_sofortmelder_api --test-status ABC123\n'
            )
        )
