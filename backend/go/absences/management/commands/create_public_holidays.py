"""
Management Command zum Erstellen von Feiertags-Abwesenheiten für alle Mitarbeiter
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from absences.models import AbsenceType, Absence
from datetime import datetime, date
import calendar

User = get_user_model()


class Command(BaseCommand):
    help = 'Erstellt automatisch Feiertags-Abwesenheiten für alle Mitarbeiter (Hamburg)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            default=datetime.now().year,
            help='Jahr für das Feiertage erstellt werden sollen (Standard: aktuelles Jahr)'
        )

    def handle(self, *args, **options):
        year = options['year']
        
        # Hole oder erstelle PUBLIC_HOLIDAY AbsenceType
        public_holiday_type, created = AbsenceType.objects.get_or_create(
            name=AbsenceType.PUBLIC_HOLIDAY,
            defaults={
                'display_name': 'Feiertag',
                'description': 'Gesetzlicher Feiertag (Hamburg)',
                'requires_approval': False,
                'requires_certificate': False,
                'advance_notice_days': 0,
                'color_code': '#6c757d',  # Grau
                'is_active': True,
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ AbsenceType "Feiertag" erstellt'))
        
        # Berechne alle Feiertage für das Jahr
        holidays = self.get_german_holidays(year)
        
        # Hole alle aktiven Benutzer
        users = User.objects.filter(is_active=True)
        
        created_count = 0
        updated_count = 0
        
        for user in users:
            for holiday_date, holiday_name in holidays:
                # Prüfe ob Abwesenheit bereits existiert
                absence, created = Absence.objects.get_or_create(
                    user=user,
                    absence_type=public_holiday_type,
                    start_date=holiday_date,
                    end_date=holiday_date,
                    defaults={
                        'status': Absence.APPROVED,
                        'reason': holiday_name,
                        'manual_duration_days': 0,  # Feiertage zählen nicht als Arbeitstage
                        'hr_notified': True,
                        'representative_confirmed': True,
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    # Update falls sich etwas geändert hat
                    if absence.reason != holiday_name or absence.status != Absence.APPROVED:
                        absence.reason = holiday_name
                        absence.status = Absence.APPROVED
                        absence.save()
                        updated_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Feiertage für {year} erstellt/aktualisiert:\n'
                f'  - {len(holidays)} Feiertage\n'
                f'  - {users.count()} Mitarbeiter\n'
                f'  - {created_count} neue Einträge erstellt\n'
                f'  - {updated_count} Einträge aktualisiert'
            )
        )
    
    def get_german_holidays(self, year):
        """
        Berechnet deutsche Feiertage für Hamburg
        Returns: List of (date, name) tuples
        """
        holidays = []
        
        # Feste Feiertage
        holidays.append((date(year, 1, 1), 'Neujahr'))
        holidays.append((date(year, 5, 1), 'Tag der Arbeit'))
        holidays.append((date(year, 10, 3), 'Tag der Deutschen Einheit'))
        holidays.append((date(year, 10, 31), 'Reformationstag'))  # Hamburg seit 2018
        holidays.append((date(year, 12, 25), '1. Weihnachtstag'))
        holidays.append((date(year, 12, 26), '2. Weihnachtstag'))
        
        # Bewegliche Feiertage (basierend auf Ostern)
        easter = self.calculate_easter(year)
        
        # Karfreitag (2 Tage vor Ostern)
        good_friday = self.add_days(easter, -2)
        holidays.append((good_friday, 'Karfreitag'))
        
        # Ostermontag (1 Tag nach Ostern)
        easter_monday = self.add_days(easter, 1)
        holidays.append((easter_monday, 'Ostermontag'))
        
        # Christi Himmelfahrt (39 Tage nach Ostern)
        ascension = self.add_days(easter, 39)
        holidays.append((ascension, 'Christi Himmelfahrt'))
        
        # Pfingstmontag (50 Tage nach Ostern)
        whit_monday = self.add_days(easter, 50)
        holidays.append((whit_monday, 'Pfingstmontag'))
        
        return sorted(holidays)
    
    def calculate_easter(self, year):
        """Berechnet Ostersonntag nach Gauß'scher Osterformel"""
        a = year % 19
        b = year // 100
        c = year % 100
        d = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1
        
        return date(year, month, day)
    
    def add_days(self, d, days):
        """Fügt Tage zu einem Datum hinzu"""
        from datetime import timedelta
        return d + timedelta(days=days)
