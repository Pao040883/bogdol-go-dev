"""Test Presence API QuerySet"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import UserPresence

# Teste das QuerySet wie es in der API verwendet wird
qs = UserPresence.objects.filter(
    status='online',
    websocket_channel_name__isnull=False
).exclude(
    websocket_channel_name=''
).select_related('user')

print(f'=== Presence API QuerySet ===')
print(f'Count: {qs.count()}\n')

for p in qs:
    print(f'{p.user.username:20} | {p.user.get_full_name()}')
