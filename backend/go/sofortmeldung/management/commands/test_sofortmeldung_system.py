# management/commands/test_sofortmeldung_system.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from sofortmeldung.models import Sofortmeldung
from sofortmeldung.services import SofortmelderAPIService
from sofortmeldung.tasks import process_sofortmeldung
from datetime import date
import time

class Command(BaseCommand):
    help = 'Testet das komplette Sofortmeldung-System'

    def add_arguments(self, parser):
        parser.add_argument(
            '--live',
            action='store_true',
            help='Führt echte API-Calls durch (sonst nur Simulation)',
        )
        parser.add_argument(
            '--track',
            action='store_true',
            help='Verfolgt den Status mit Live-Tracking',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Starte Sofortmeldung-System Test')
        )
        
        # 1. Test-User erstellen/finden
        user, created = User.objects.get_or_create(
            username='test_user',
            defaults={
                'email': 'test@example.com',
                'first_name': 'Test',
                'last_name': 'User'
            }
        )
        
        if created:
            self.stdout.write('✅ Test-User erstellt')
        else:
            self.stdout.write('✅ Test-User gefunden')
        
        # 2. Test-Sofortmeldung erstellen
        test_data = {
            'first_name': 'Max',
            'last_name': 'Mustermann',
            'birthday': date(1990, 5, 15),
            'start_date': date.today(),
            'duration': 5,
            'phone_number': '+49123456789',
            'email': 'max.mustermann@example.com',
            'reason': 'Fieber und Husten',
            'doctor_visit': True,
            'createdBy': user
        }
        
        sofortmeldung = Sofortmeldung.objects.create(**test_data)
        self.stdout.write(
            self.style.SUCCESS(f'✅ Test-Sofortmeldung erstellt (ID: {sofortmeldung.id})')
        )
        
        # 3. API-Service testen
        if options['live']:
            self.stdout.write('🌐 Teste Live-API...')
            
            try:
                api_service = SofortmelderAPIService()
                
                # Token-Status prüfen
                self.stdout.write('🔑 Prüfe Token-Status...')
                if api_service.ensure_valid_token():
                    self.stdout.write(self.style.SUCCESS('✅ Token ist gültig'))
                else:
                    self.stdout.write(self.style.ERROR('❌ Token-Problem'))
                    return
                
                # Sofortmeldung senden
                self.stdout.write('📤 Sende Sofortmeldung...')
                result = api_service.create_sofortmeldung(sofortmeldung)
                
                if result:
                    sofortmeldung.tan = result.get('tan')
                    sofortmeldung.url = result.get('url')
                    sofortmeldung.status = True
                    sofortmeldung.save()
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'✅ Sofortmeldung erfolgreich gesendet')
                    )
                    self.stdout.write(f'📋 TAN: {sofortmeldung.tan}')
                    self.stdout.write(f'🔗 URL: {sofortmeldung.url}')
                    
                    # Live-Tracking testen
                    if options['track']:
                        self.stdout.write('👁️ Starte Live-Tracking...')
                        self.test_live_tracking(sofortmeldung)
                
                else:
                    self.stdout.write(self.style.ERROR('❌ Sofortmeldung-Sendung fehlgeschlagen'))
            
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ API-Fehler: {str(e)}')
                )
        
        else:
            # Simulation
            self.stdout.write('🎭 Simuliere API-Calls...')
            
            # Task testen (ohne echte API-Calls)
            self.stdout.write('⚙️ Teste Celery-Task...')
            task_result = process_sofortmeldung.delay(sofortmeldung.id)
            
            self.stdout.write(f'✅ Task gestartet (ID: {task_result.id})')
            
            # Warten auf Task-Completion
            self.stdout.write('⏳ Warte auf Task-Completion...')
            timeout = 30
            while timeout > 0 and not task_result.ready():
                time.sleep(1)
                timeout -= 1
                self.stdout.write('.', ending='')
            
            if task_result.ready():
                if task_result.successful():
                    self.stdout.write(self.style.SUCCESS('\n✅ Task erfolgreich abgeschlossen'))
                    
                    # Ergebnis prüfen
                    sofortmeldung.refresh_from_db()
                    if sofortmeldung.tan:
                        self.stdout.write(f'📋 TAN: {sofortmeldung.tan}')
                    if sofortmeldung.url:
                        self.stdout.write(f'🔗 URL: {sofortmeldung.url}')
                        
                else:
                    self.stdout.write(self.style.ERROR('\n❌ Task fehlgeschlagen'))
                    self.stdout.write(f'Fehler: {task_result.result}')
            else:
                self.stdout.write(self.style.WARNING('\n⚠️ Task-Timeout'))
        
        # 4. Dashboard-Statistiken testen
        self.stdout.write('\n📊 Teste Dashboard-Statistiken...')
        
        total = Sofortmeldung.objects.count()
        successful = Sofortmeldung.objects.filter(status=True).count()
        failed = Sofortmeldung.objects.filter(status=False, tan__isnull=False).count()
        pending = total - successful - failed
        
        self.stdout.write(f'📈 Gesamt: {total}')
        self.stdout.write(f'✅ Erfolgreich: {successful}')
        self.stdout.write(f'❌ Fehlgeschlagen: {failed}')
        self.stdout.write(f'⏳ Ausstehend: {pending}')
        
        if total > 0:
            success_rate = round((successful / total) * 100, 1)
            self.stdout.write(f'📊 Erfolgsrate: {success_rate}%')
        
        # 5. Cleanup fragen
        cleanup = input('\n🗑️ Test-Daten löschen? (j/N): ')
        if cleanup.lower() in ['j', 'ja', 'yes', 'y']:
            sofortmeldung.delete()
            if created:
                user.delete()
            self.stdout.write(self.style.SUCCESS('✅ Test-Daten gelöscht'))
        
        self.stdout.write(
            self.style.SUCCESS('\n🎉 Sofortmeldung-System Test abgeschlossen!')
        )
    
    def test_live_tracking(self, sofortmeldung):
        """Testet das Live-Tracking System"""
        self.stdout.write('🔄 Simuliere Live-Tracking für 30 Sekunden...')
        
        for i in range(6):  # 6 x 5 Sekunden = 30 Sekunden
            time.sleep(5)
            
            # Status prüfen
            try:
                api_service = SofortmelderAPIService()
                status_result = api_service.check_sofortmeldung(sofortmeldung.tan)
                
                self.stdout.write(
                    f'👁️ Check {i+1}/6 - Status: {status_result.get("status", "unknown")}'
                )
                
                if status_result.get('status') == 'completed':
                    self.stdout.write(self.style.SUCCESS('✅ Sofortmeldung abgeschlossen!'))
                    break
                    
            except Exception as e:
                self.stdout.write(f'⚠️ Status-Check Fehler: {str(e)}')
        
        self.stdout.write('👁️ Live-Tracking Test beendet')
