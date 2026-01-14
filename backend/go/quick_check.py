import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

u = User.objects.get(username='dkomsic')
print(f'User: {u.username} ({u.get_full_name()})')
print(f'Hat profile: {hasattr(u, "profile")}')
if hasattr(u, 'profile') and u.profile.direct_supervisor:
    print(f'Supervisor: {u.profile.direct_supervisor.username} ({u.profile.direct_supervisor.get_full_name()})')
else:
    print(f'Supervisor: None')
