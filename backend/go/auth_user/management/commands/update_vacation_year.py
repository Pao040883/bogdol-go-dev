"""
Management Command für Urlaubsjahreswechsel

Verwendung:
    python manage.py update_vacation_year [--year JAHR] [--dry-run] [--limit-carryover TAGE]

Beispiele:
    # Führe Jahreswechsel für aktuelles Jahr aus
    python manage.py update_vacation_year
    
    # Teste ohne Änderungen
    python manage.py update_vacation_year --dry-run
    
    # Jahreswechsel für spezifisches Jahr
    python manage.py update_vacation_year --year 2026
    
    # Mit Begrenzung des Resturlaubs auf 5 Tage
    python manage.py update_vacation_year --limit-carryover 5
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = 'Aktualisiert Urlaubsjahr und Resturlaub für alle Benutzer (Jahreswechsel)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            help='Zieljahr für den Jahreswechsel (Standard: aktuelles Jahr)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Testmodus - keine Änderungen speichern',
        )
        parser.add_argument(
            '--limit-carryover',
            type=int,
            help='Maximale Resturlaubstage (z.B. 5), optional',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Erzwinge Update auch für bereits aktualisierte Benutzer',
        )

    def handle(self, *args, **options):
        target_year = options.get('year') or timezone.now().year
        dry_run = options.get('dry_run', False)
        limit_carryover = options.get('limit_carryover')
        force = options.get('force', False)
        
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n{'='*70}\n"
            f"  Urlaubsjahreswechsel auf Jahr {target_year}\n"
            f"{'='*70}\n"
        ))
        
        if dry_run:
            self.stdout.write(self.style.WARNING("⚠️  DRY RUN Modus - Keine Änderungen werden gespeichert!\n"))
        
        if limit_carryover:
            self.stdout.write(self.style.NOTICE(
                f"ℹ️  Resturlaub wird auf maximal {limit_carryover} Tage begrenzt\n"
            ))
        
        # Hole alle aktiven Benutzer
        users = User.objects.filter(is_active=True)
        
        if not force:
            # Filtere Benutzer die noch nicht aktualisiert wurden
            users = users.filter(vacation_year__lt=target_year)
        
        total_users = users.count()
        
        if total_users == 0:
            self.stdout.write(self.style.SUCCESS(
                "✅ Keine Benutzer zum Aktualisieren gefunden.\n"
                "   Alle Benutzer sind bereits auf dem neuesten Stand.\n"
            ))
            return
        
        self.stdout.write(f"📊 {total_users} Benutzer gefunden\n")
        self.stdout.write("-" * 70)
        
        updated_count = 0
        error_count = 0
        stats = {
            'total_carryover': 0,
            'max_carryover': 0,
            'min_carryover': float('inf'),
            'users_with_carryover': 0,
        }
        
        with transaction.atomic():
            for user in users:
                try:
                    # Berechne verbleibenden Urlaub aus dem Vorjahr
                    previous_year = user.vacation_year
                    remaining_days = user.get_remaining_vacation_days(previous_year)
                    
                    # Optional: Begrenze Resturlaub
                    original_remaining = remaining_days
                    if limit_carryover is not None:
                        remaining_days = min(remaining_days, limit_carryover)
                    
                    # Statistiken
                    stats['total_carryover'] += remaining_days
                    if remaining_days > 0:
                        stats['users_with_carryover'] += 1
                        stats['max_carryover'] = max(stats['max_carryover'], remaining_days)
                        stats['min_carryover'] = min(stats['min_carryover'], remaining_days)
                    
                    # Ausgabe
                    self.stdout.write(
                        f"  {user.username:20} | "
                        f"Jahr: {previous_year} → {target_year} | "
                        f"Resturlaub: {remaining_days:2} Tage"
                    )
                    
                    if limit_carryover and original_remaining > remaining_days:
                        self.stdout.write(self.style.WARNING(
                            f"    ⚠️  Resturlaub begrenzt: {original_remaining} → {remaining_days} Tage"
                        ))
                    
                    # Speichern (nur wenn kein dry-run)
                    if not dry_run:
                        user.carryover_vacation = remaining_days
                        user.vacation_year = target_year
                        user.save(update_fields=['carryover_vacation', 'vacation_year'])
                    
                    updated_count += 1
                    
                except Exception as e:
                    error_count += 1
                    self.stdout.write(self.style.ERROR(
                        f"  ❌ Fehler bei {user.username}: {e}"
                    ))
            
            # Rollback bei dry-run
            if dry_run:
                transaction.set_rollback(True)
        
        # Zusammenfassung
        self.stdout.write("\n" + "="*70)
        self.stdout.write(self.style.MIGRATE_HEADING("  ZUSAMMENFASSUNG"))
        self.stdout.write("="*70)
        
        if dry_run:
            self.stdout.write(self.style.WARNING("⚠️  DRY RUN - Keine Änderungen gespeichert\n"))
        
        self.stdout.write(f"✅ Erfolgreich aktualisiert: {updated_count} Benutzer")
        
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f"❌ Fehler: {error_count} Benutzer"))
        
        if stats['users_with_carryover'] > 0:
            avg_carryover = stats['total_carryover'] / stats['users_with_carryover']
            self.stdout.write("\n📊 Resturlaub-Statistik:")
            self.stdout.write(f"   • Benutzer mit Resturlaub: {stats['users_with_carryover']}")
            self.stdout.write(f"   • Gesamt-Resturlaub: {stats['total_carryover']} Tage")
            self.stdout.write(f"   • Durchschnitt: {avg_carryover:.1f} Tage")
            self.stdout.write(f"   • Maximum: {stats['max_carryover']} Tage")
            self.stdout.write(f"   • Minimum: {stats['min_carryover']} Tage")
        
        self.stdout.write("\n" + "="*70 + "\n")
        
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"✨ Urlaubsjahreswechsel auf {target_year} erfolgreich abgeschlossen!"
            ))
        else:
            self.stdout.write(self.style.NOTICE(
                "ℹ️  Führe den Befehl ohne --dry-run aus, um Änderungen zu speichern."
            ))
