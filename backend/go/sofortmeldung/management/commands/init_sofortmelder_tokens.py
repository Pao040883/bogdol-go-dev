# sofortmeldung/management/commands/init_sofortmelder_tokens.py
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from sofortmeldung.services import SofortmelderAPIService

class Command(BaseCommand):
    help = 'Initialisiert Sofortmelder.de API Tokens im Cache'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🔧 Initialisiere Sofortmelder Tokens...')
        )
        
        try:
            # Service initialisieren (das sollte das initiale Token in den Cache setzen)
            service = SofortmelderAPIService()
            
            # Prüfen ob Token jetzt im Cache ist
            access_token = cache.get('sofortmelder_access_token')
            
            if access_token:
                token_preview = f"{access_token[:15]}...{access_token[-15:]}"
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Initiales Access Token in Cache gesetzt: {token_preview}')
                )
                
                # TTL prüfen
                ttl = cache.ttl('sofortmelder_access_token')
                if ttl:
                    days = ttl // (24 * 3600)
                    hours = (ttl % (24 * 3600)) // 3600
                    self.stdout.write(f'   Gültig für: {days} Tage, {hours} Stunden')
            else:
                self.stdout.write(
                    self.style.ERROR('❌ Initiales Token wurde nicht in Cache gesetzt')
                )
                
                # Debug-Info
                initial_token = getattr(settings, 'SOFORTMELDER_ACCESS_TOKEN', '')
                if initial_token:
                    self.stdout.write(f'   Token in Settings vorhanden: {initial_token[:15]}...')
                else:
                    self.stdout.write('   Kein Token in Settings gefunden')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Fehler bei Initialisierung: {e}')
            )
