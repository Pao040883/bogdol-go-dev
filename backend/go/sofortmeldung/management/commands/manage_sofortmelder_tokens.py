# sofortmeldung/management/commands/manage_sofortmelder_tokens.py
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from sofortmeldung.services import SofortmelderAPIService
import json

class Command(BaseCommand):
    help = 'Verwaltet Sofortmelder.de API Tokens'

    def add_arguments(self, parser):
        parser.add_argument(
            '--refresh',
            action='store_true',
            help='Erneuert das Access Token',
        )
        parser.add_argument(
            '--status',
            action='store_true',
            help='Zeigt Token-Status an',
        )
        parser.add_argument(
            '--clear-cache',
            action='store_true',
            help='Löscht alle gecachten Tokens',
        )
        parser.add_argument(
            '--test-auth',
            action='store_true',
            help='Testet die Authentifizierung',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🔑 Sofortmelder Token-Management')
        )

        if options['status']:
            self.show_token_status()
        elif options['refresh']:
            self.refresh_token()
        elif options['clear_cache']:
            self.clear_token_cache()
        elif options['test_auth']:
            self.test_authentication()
        else:
            self.show_help()

    def show_token_status(self):
        """Zeigt den aktuellen Token-Status"""
        self.stdout.write("\n📊 Token-Status:")
        
        # Cache-Keys
        access_token_key = 'sofortmelder_access_token'
        refresh_token_key = 'sofortmelder_refresh_token'
        
        # Access Token Status
        access_token = cache.get(access_token_key)
        if access_token:
            token_preview = f"{access_token[:15]}...{access_token[-15:]}" if len(access_token) > 30 else access_token
            self.stdout.write(
                self.style.SUCCESS(f"✅ Access Token: {token_preview}")
            )
            
            # TTL prüfen
            ttl = cache.ttl(access_token_key)
            if ttl:
                hours = ttl // 3600
                minutes = (ttl % 3600) // 60
                self.stdout.write(f"   Läuft ab in: {hours}h {minutes}m")
            else:
                self.stdout.write("   TTL: Unbekannt")
        else:
            self.stdout.write(
                self.style.WARNING("⚠️  Kein Access Token im Cache")
            )
        
        # Refresh Token Status
        cached_refresh_token = cache.get(refresh_token_key)
        settings_refresh_token = getattr(settings, 'SOFORTMELDER_REFRESH_TOKEN', '')
        
        if cached_refresh_token:
            token_preview = f"{cached_refresh_token[:15]}...{cached_refresh_token[-15:]}"
            self.stdout.write(
                self.style.SUCCESS(f"✅ Refresh Token (Cache): {token_preview}")
            )
            
            # TTL prüfen
            ttl = cache.ttl(refresh_token_key)
            if ttl:
                days = ttl // (24 * 3600)
                self.stdout.write(f"   Läuft ab in: {days} Tagen")
        elif settings_refresh_token:
            token_preview = f"{settings_refresh_token[:15]}...{settings_refresh_token[-15:]}"
            self.stdout.write(
                self.style.WARNING(f"⚠️  Refresh Token (Settings): {token_preview}")
            )
            self.stdout.write("   (Nicht im Cache, wird aus Settings gelesen)")
        else:
            self.stdout.write(
                self.style.ERROR("❌ Kein Refresh Token konfiguriert")
            )

    def refresh_token(self):
        """Erneuert das Access Token"""
        self.stdout.write("\n🔄 Erneuere Access Token...")
        
        try:
            api_service = SofortmelderAPIService()
            
            # Cache löschen um Refresh zu erzwingen
            cache.delete('sofortmelder_access_token')
            
            # Neues Token holen
            new_token = api_service.refresh_access_token()
            
            if new_token:
                token_preview = f"{new_token[:15]}...{new_token[-15:]}"
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Neues Access Token erhalten: {token_preview}")
                )
                
                # TTL prüfen
                ttl = cache.ttl('sofortmelder_access_token')
                if ttl:
                    hours = ttl // 3600
                    self.stdout.write(f"   Gültig für: {hours} Stunden")
            else:
                self.stdout.write(
                    self.style.ERROR("❌ Token-Refresh fehlgeschlagen")
                )
                self.stdout.write("   Prüfen Sie:")
                self.stdout.write("   - SOFORTMELDER_REFRESH_TOKEN in den Settings")
                self.stdout.write("   - Netzwerkverbindung zur API")
                self.stdout.write("   - Gültigkeit des Refresh Tokens")
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Fehler beim Token-Refresh: {e}")
            )

    def clear_token_cache(self):
        """Löscht alle gecachten Tokens"""
        self.stdout.write("\n🗑️  Lösche Token-Cache...")
        
        # Cache-Keys löschen
        cache.delete('sofortmelder_access_token')
        cache.delete('sofortmelder_refresh_token')
        
        self.stdout.write(
            self.style.SUCCESS("✅ Token-Cache erfolgreich geleert")
        )
        self.stdout.write("   Beim nächsten API-Call wird ein neues Access Token geholt")

    def test_authentication(self):
        """Testet die komplette Authentifizierung"""
        self.stdout.write("\n🧪 Teste Authentifizierung...")
        
        try:
            api_service = SofortmelderAPIService()
            
            # 1. Token Status prüfen
            self.stdout.write("   1. Prüfe Token-Status...")
            access_token = cache.get('sofortmelder_access_token')
            if access_token:
                self.stdout.write(
                    self.style.SUCCESS("   ✅ Access Token im Cache gefunden")
                )
            else:
                self.stdout.write(
                    self.style.WARNING("   ⚠️  Kein Access Token im Cache")
                )
            
            # 2. Access Token holen (mit automatischem Refresh)
            self.stdout.write("   2. Hole/Erneuere Access Token...")
            token = api_service.get_access_token()
            
            if token:
                token_preview = f"{token[:15]}...{token[-15:]}"
                self.stdout.write(
                    self.style.SUCCESS(f"   ✅ Access Token erhalten: {token_preview}")
                )
                
                # 3. Header generieren
                self.stdout.write("   3. Generiere Authentifizierungs-Header...")
                headers = api_service.get_headers()
                auth_header = headers.get('Authorization', '')
                header_preview = f"{auth_header[:25]}...{auth_header[-15:]}" if len(auth_header) > 40 else auth_header
                
                self.stdout.write(
                    self.style.SUCCESS(f"   ✅ Authorization Header: {header_preview}")
                )
                
                self.stdout.write(
                    self.style.SUCCESS("\n🎉 Authentifizierung erfolgreich!")
                )
                self.stdout.write("   Die API ist bereit für Sofortmeldung-Requests")
                
            else:
                self.stdout.write(
                    self.style.ERROR("   ❌ Kein gültiges Access Token erhalten")
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"   ❌ Authentifizierungs-Test fehlgeschlagen: {e}")
            )

    def show_help(self):
        """Zeigt verfügbare Optionen"""
        self.stdout.write(
            self.style.WARNING(
                '\n🔑 Verfügbare Token-Management Optionen:\n'
                '  --status      : Zeigt aktuellen Token-Status\n'
                '  --refresh     : Erneuert das Access Token\n'
                '  --clear-cache : Löscht alle gecachten Tokens\n'
                '  --test-auth   : Testet komplette Authentifizierung\n'
                '\nBeispiele:\n'
                '  python manage.py manage_sofortmelder_tokens --status\n'
                '  python manage.py manage_sofortmelder_tokens --refresh\n'
                '  python manage.py manage_sofortmelder_tokens --test-auth\n'
            )
        )
