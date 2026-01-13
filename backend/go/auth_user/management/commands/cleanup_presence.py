"""
Management Command: Bereinige verwaiste Online-Status

Setzt alle User auf offline, die als online markiert sind, aber:
1. Keine aktive WebSocket-Verbindung haben ODER
2. Deren last_seen älter als 5 Minuten ist (tote Verbindung)

Verwendung:
    python manage.py cleanup_presence
    python manage.py cleanup_presence --timeout 10  # 10 Minuten Timeout
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from auth_user.profile_models import UserPresence


class Command(BaseCommand):
    help = 'Bereinigt verwaiste Online-Status (User ohne WebSocket oder Timeout)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout',
            type=int,
            default=5,
            help='Timeout in Minuten (default: 5)'
        )

    def handle(self, *args, **options):
        timeout_minutes = options['timeout']
        timeout_threshold = timezone.now() - timedelta(minutes=timeout_minutes)
        
        self.stdout.write(f'Starte Presence Cleanup (Timeout: {timeout_minutes} Min)...\n')
        
        # Fall 1: User ohne WebSocket-Verbindung
        orphaned_no_ws = UserPresence.objects.filter(
            status='online'
        ).filter(
            websocket_channel_name__isnull=True
        ) | UserPresence.objects.filter(
            status='online',
            websocket_channel_name=''
        )
        
        count_no_ws = orphaned_no_ws.count()
        
        if count_no_ws > 0:
            self.stdout.write(f'📍 {count_no_ws} User ohne WebSocket-Verbindung:')
            for presence in orphaned_no_ws:
                username = presence.user.username
                presence.status = 'offline'
                presence.websocket_channel_name = ''
                presence.save(update_fields=['status', 'websocket_channel_name', 'updated_at'])
                self.stdout.write(f'  ⚫ {username} → offline (keine WS)')
        
        # Fall 2: User mit altem last_seen (tote Verbindung)
        orphaned_timeout = UserPresence.objects.filter(
            status='online',
            last_seen__lt=timeout_threshold
        ).exclude(
            websocket_channel_name__isnull=True
        ).exclude(
            websocket_channel_name=''
        )
        
        count_timeout = orphaned_timeout.count()
        
        if count_timeout > 0:
            self.stdout.write(f'\n📍 {count_timeout} User mit Timeout (>{timeout_minutes} Min):')
            for presence in orphaned_timeout:
                username = presence.user.username
                minutes_ago = (timezone.now() - presence.last_seen).total_seconds() / 60
                presence.status = 'offline'
                presence.websocket_channel_name = ''
                presence.save(update_fields=['status', 'websocket_channel_name', 'updated_at'])
                self.stdout.write(f'  ⚫ {username} → offline (last_seen: {minutes_ago:.1f} Min)')
        
        total = count_no_ws + count_timeout
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS('✅ Keine verwaisten Online-Status gefunden'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n✅ {total} User auf offline gesetzt'))

