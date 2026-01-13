# sofortmeldung/management/commands/process_sofortmeldungen.py
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from sofortmeldung.models import Sofortmeldung
from sofortmeldung.tasks import process_sofortmeldung, batch_process_pending_sofortmeldungen
import time

class Command(BaseCommand):
    help = 'Verarbeitet ausstehende Sofortmeldungen'

    def add_arguments(self, parser):
        parser.add_argument(
            '--id',
            type=int,
            help='Spezifische Sofortmeldung-ID verarbeiten',
        )
        parser.add_argument(
            '--all-pending',
            action='store_true',
            help='Alle ausstehenden Sofortmeldungen verarbeiten',
        )
        parser.add_argument(
            '--failed',
            action='store_true',
            help='Fehlgeschlagene Sofortmeldungen erneut verarbeiten',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Zeigt nur an, was verarbeitet würde (ohne tatsächliche Verarbeitung)',
        )
        parser.add_argument(
            '--wait',
            action='store_true',
            help='Wartet auf Completion der Tasks',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Starte Sofortmeldung-Verarbeitung...')
        )

        if options['id']:
            self.process_single(options['id'], options['dry_run'], options['wait'])
        elif options['all_pending']:
            self.process_pending(options['dry_run'], options['wait'])
        elif options['failed']:
            self.process_failed(options['dry_run'], options['wait'])
        else:
            self.show_statistics()
            self.stdout.write(
                self.style.WARNING(
                    '\nBitte spezifizieren Sie eine Aktion:\n'
                    '  --id <ID>        : Spezifische Sofortmeldung verarbeiten\n'
                    '  --all-pending    : Alle ausstehenden verarbeiten\n'
                    '  --failed         : Fehlgeschlagene erneut verarbeiten\n'
                )
            )

    def process_single(self, sofortmeldung_id, dry_run, wait):
        """Verarbeitet eine einzelne Sofortmeldung"""
        try:
            sofortmeldung = Sofortmeldung.objects.get(id=sofortmeldung_id)
            
            self.stdout.write(
                f"📋 Sofortmeldung {sofortmeldung_id}: "
                f"{sofortmeldung.first_name} {sofortmeldung.last_name} "
                f"(Start: {sofortmeldung.start_date})"
            )
            
            if dry_run:
                self.stdout.write(
                    self.style.WARNING('🔍 Dry-Run: Würde verarbeitet werden')
                )
                return
            
            # Task starten
            task_result = process_sofortmeldung.delay(sofortmeldung_id)
            self.stdout.write(
                self.style.SUCCESS(f'✅ Task gestartet: {task_result.id}')
            )
            
            if wait:
                self.wait_for_task(task_result)
                
        except Sofortmeldung.DoesNotExist:
            raise CommandError(f'Sofortmeldung mit ID {sofortmeldung_id} nicht gefunden')

    def process_pending(self, dry_run, wait):
        """Verarbeitet alle ausstehenden Sofortmeldungen"""
        pending = Sofortmeldung.objects.filter(status=False, tan__isnull=True)
        count = pending.count()
        
        self.stdout.write(f"📊 {count} ausstehende Sofortmeldungen gefunden")
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('✅ Keine ausstehenden Sofortmeldungen')
            )
            return
        
        if dry_run:
            for meldung in pending:
                self.stdout.write(
                    f"🔍 Würde verarbeiten: {meldung.id} - "
                    f"{meldung.first_name} {meldung.last_name}"
                )
            return
        
        # Batch-Task starten
        task_result = batch_process_pending_sofortmeldungen.delay()
        self.stdout.write(
            self.style.SUCCESS(f'✅ Batch-Task gestartet: {task_result.id}')
        )
        
        if wait:
            self.wait_for_task(task_result)

    def process_failed(self, dry_run, wait):
        """Verarbeitet fehlgeschlagene Sofortmeldungen erneut"""
        failed = Sofortmeldung.objects.filter(status=False, tan__isnull=False)
        count = failed.count()
        
        self.stdout.write(f"📊 {count} fehlgeschlagene Sofortmeldungen gefunden")
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('✅ Keine fehlgeschlagenen Sofortmeldungen')
            )
            return
        
        if dry_run:
            for meldung in failed:
                self.stdout.write(
                    f"🔍 Würde erneut verarbeiten: {meldung.id} - "
                    f"{meldung.first_name} {meldung.last_name} (TAN: {meldung.tan})"
                )
            return
        
        # Tasks für jede fehlgeschlagene Meldung starten
        task_results = []
        for meldung in failed:
            # Reset status
            meldung.status = False
            meldung.tan = ''
            meldung.url = ''
            meldung.save()
            
            # Task starten
            task_result = process_sofortmeldung.delay(meldung.id)
            task_results.append(task_result)
            
        self.stdout.write(
            self.style.SUCCESS(f'✅ {len(task_results)} Tasks gestartet')
        )
        
        if wait:
            for task_result in task_results:
                self.wait_for_task(task_result)

    def show_statistics(self):
        """Zeigt Statistiken über Sofortmeldungen"""
        total = Sofortmeldung.objects.count()
        successful = Sofortmeldung.objects.filter(status=True).count()
        pending = Sofortmeldung.objects.filter(status=False, tan__isnull=True).count()
        failed = Sofortmeldung.objects.filter(status=False, tan__isnull=False).count()
        
        self.stdout.write("\n📊 Sofortmeldung-Statistiken:")
        self.stdout.write(f"   Gesamt:        {total}")
        self.stdout.write(
            self.style.SUCCESS(f"   Erfolgreich:   {successful}")
        )
        self.stdout.write(
            self.style.WARNING(f"   Ausstehend:    {pending}")
        )
        self.stdout.write(
            self.style.ERROR(f"   Fehlgeschlagen: {failed}")
        )
        
        if total > 0:
            success_rate = (successful / total) * 100
            self.stdout.write(f"   Erfolgsquote:  {success_rate:.1f}%")

    def wait_for_task(self, task_result):
        """Wartet auf die Completion eines Tasks"""
        self.stdout.write('⏳ Warte auf Task-Completion...')
        
        while not task_result.ready():
            time.sleep(2)
            self.stdout.write('.', ending='')
            
        self.stdout.write('')  # Neue Zeile
        
        if task_result.successful():
            result = task_result.result
            self.stdout.write(
                self.style.SUCCESS(f"✅ Task erfolgreich: {result}")
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"❌ Task fehlgeschlagen: {task_result.result}")
            )
