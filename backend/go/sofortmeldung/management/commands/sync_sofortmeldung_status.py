# sofortmeldung/management/commands/sync_sofortmeldung_status.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from sofortmeldung.models import Sofortmeldung
from sofortmeldung.tasks import check_sofortmeldung_status
import time

class Command(BaseCommand):
    help = 'Synchronisiert Status von Sofortmeldungen mit der API'

    def add_arguments(self, parser):
        parser.add_argument(
            '--id',
            type=int,
            help='Spezifische Sofortmeldung-ID prüfen',
        )
        parser.add_argument(
            '--with-tan',
            action='store_true',
            help='Alle Sofortmeldungen mit TAN prüfen',
        )
        parser.add_argument(
            '--pending-only',
            action='store_true',
            help='Nur noch nicht erfolgreiche Meldungen prüfen',
        )
        parser.add_argument(
            '--max-age',
            type=int,
            default=30,
            help='Maximales Alter in Tagen (default: 30)',
        )
        parser.add_argument(
            '--wait',
            action='store_true',
            help='Wartet auf Completion der Tasks',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🔄 Starte Status-Synchronisation...')
        )

        if options['id']:
            self.sync_single(options['id'], options['wait'])
        elif options['with_tan']:
            self.sync_with_tan(options['pending_only'], options['max_age'], options['wait'])
        else:
            self.show_sync_candidates(options['max_age'])
            self.stdout.write(
                self.style.WARNING(
                    '\nBitte spezifizieren Sie eine Aktion:\n'
                    '  --id <ID>        : Spezifische Sofortmeldung prüfen\n'
                    '  --with-tan       : Alle mit TAN prüfen\n'
                    '  --pending-only   : Nur noch nicht erfolgreiche\n'
                )
            )

    def sync_single(self, sofortmeldung_id, wait):
        """Synchronisiert eine einzelne Sofortmeldung"""
        try:
            sofortmeldung = Sofortmeldung.objects.get(id=sofortmeldung_id)
            
            if not sofortmeldung.tan:
                self.stdout.write(
                    self.style.ERROR(
                        f"❌ Sofortmeldung {sofortmeldung_id} hat keine TAN"
                    )
                )
                return
            
            self.stdout.write(
                f"🔄 Prüfe Status von Sofortmeldung {sofortmeldung_id} "
                f"(TAN: {sofortmeldung.tan})"
            )
            
            # Task starten
            task_result = check_sofortmeldung_status.delay(sofortmeldung_id)
            self.stdout.write(
                self.style.SUCCESS(f'✅ Status-Check gestartet: {task_result.id}')
            )
            
            if wait:
                self.wait_for_task(task_result)
                
        except Sofortmeldung.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(
                    f'Sofortmeldung mit ID {sofortmeldung_id} nicht gefunden'
                )
            )

    def sync_with_tan(self, pending_only, max_age_days, wait):
        """Synchronisiert alle Sofortmeldungen mit TAN"""
        # Queryset aufbauen
        queryset = Sofortmeldung.objects.filter(tan__isnull=False).exclude(tan='')
        
        if pending_only:
            queryset = queryset.filter(status=False)
        
        # Maximales Alter berücksichtigen
        cutoff_date = timezone.now().date() - timezone.timedelta(days=max_age_days)
        queryset = queryset.filter(created_at__date__gte=cutoff_date)
        
        meldungen = list(queryset.order_by('-created_at'))
        count = len(meldungen)
        
        self.stdout.write(f"📊 {count} Sofortmeldungen zum Synchronisieren gefunden")
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('✅ Keine Sofortmeldungen zum Synchronisieren')
            )
            return
        
        # Status für jede Meldung prüfen
        task_results = []
        for meldung in meldungen:
            self.stdout.write(
                f"🔄 Starte Check für ID {meldung.id} "
                f"({meldung.first_name} {meldung.last_name}, TAN: {meldung.tan})"
            )
            
            task_result = check_sofortmeldung_status.delay(meldung.id)
            task_results.append((meldung.id, task_result))
            
            # Kleine Pause zwischen API-Calls
            time.sleep(0.5)
        
        self.stdout.write(
            self.style.SUCCESS(f'✅ {len(task_results)} Status-Checks gestartet')
        )
        
        if wait:
            for meldung_id, task_result in task_results:
                self.stdout.write(f"⏳ Warte auf Check für ID {meldung_id}...")
                self.wait_for_task(task_result)

    def show_sync_candidates(self, max_age_days):
        """Zeigt Kandidaten für Status-Synchronisation"""
        cutoff_date = timezone.now().date() - timezone.timedelta(days=max_age_days)
        
        with_tan = Sofortmeldung.objects.filter(
            tan__isnull=False,
            created_at__date__gte=cutoff_date
        ).exclude(tan='')
        
        pending_with_tan = with_tan.filter(status=False)
        successful_with_tan = with_tan.filter(status=True)
        
        self.stdout.write("\n📊 Status-Synchronisation Kandidaten:")
        self.stdout.write(f"   Mit TAN (gesamt):     {with_tan.count()}")
        self.stdout.write(
            self.style.WARNING(f"   Mit TAN (ausstehend): {pending_with_tan.count()}")
        )
        self.stdout.write(
            self.style.SUCCESS(f"   Mit TAN (erfolgreich): {successful_with_tan.count()}")
        )
        self.stdout.write(f"   Maximales Alter:      {max_age_days} Tage")
        
        if pending_with_tan.exists():
            self.stdout.write("\n🔍 Ausstehende Meldungen:")
            for meldung in pending_with_tan.order_by('-created_at')[:10]:
                age = (timezone.now().date() - meldung.created_at.date()).days
                self.stdout.write(
                    f"   ID {meldung.id}: {meldung.first_name} {meldung.last_name} "
                    f"(TAN: {meldung.tan}, {age} Tage alt)"
                )
            
            if pending_with_tan.count() > 10:
                self.stdout.write(f"   ... und {pending_with_tan.count() - 10} weitere")

    def wait_for_task(self, task_result):
        """Wartet auf die Completion eines Tasks"""
        while not task_result.ready():
            time.sleep(1)
            
        if task_result.successful():
            result = task_result.result
            self.stdout.write(
                self.style.SUCCESS(f"  ✅ Status aktualisiert: {result}")
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"  ❌ Fehler beim Status-Check: {task_result.result}")
            )
