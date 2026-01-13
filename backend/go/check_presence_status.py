"""Check current UserPresence status"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import UserPresence

presences = UserPresence.objects.all()
print(f'\n=== UserPresence Status ===')
print(f'Total: {presences.count()}\n')

for p in presences:
    channel = p.websocket_channel_name or 'NONE'
    print(f'{p.user.username:20} | status={p.status:10} | channel={channel}')

print('\n=== Online User (filtered) ===')
online = UserPresence.objects.filter(
    status='online',
    websocket_channel_name__isnull=False
).exclude(websocket_channel_name='')

print(f'Count: {online.count()}')
for p in online:
    print(f'{p.user.username:20} | {p.websocket_channel_name}')
