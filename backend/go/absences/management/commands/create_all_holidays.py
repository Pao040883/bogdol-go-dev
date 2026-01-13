"""
Management Command: Erstellt Feiertage für alle Benutzer für einen Zeitraum
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from absences.signals import create_holidays_for_user

User = get_user_model()


class Command(BaseCommand):
    help = 'Erstellt Feiertage für alle aktiven Benutzer für einen Zeitraum'

    def add_arguments(self, parser):
        parser.add_argument(
            '--start-year',
            type=int,
            default=timezone.now().year - 5,
            help='Startjahr (Standard: aktuelles Jahr - 5)'
        )
        parser.add_argument(
            '--end-year',
            type=int,
            default=timezone.now().year + 5,
            help='Endjahr (Standard: aktuelles Jahr + 5)'
        )

    def handle(self, *args, **options):
        start_year = options['start_year']
        end_year = options['end_year']
        
        years = list(range(start_year, end_year + 1))
        
        self.stdout.write(f"Erstelle Feiertage für Jahre {start_year} bis {end_year}...")
        
        users = User.objects.filter(is_active=True)
        total_users = users.count()
        total_created = 0
        
        for idx, user in enumerate(users, 1):
            created = create_holidays_for_user(user, years=years)
            total_created += created
            self.stdout.write(f"[{idx}/{total_users}] {user.username}: {created} Feiertage erstellt")
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Erfolgreich abgeschlossen!\n'
                f'Benutzer: {total_users}\n'
                f'Jahre: {len(years)} ({start_year}-{end_year})\n'
                f'Feiertags-Einträge erstellt: {total_created}'
            )
        )
