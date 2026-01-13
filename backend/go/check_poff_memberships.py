"""Check Patrick Offermanns department memberships"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import DepartmentMember
from django.contrib.auth import get_user_model

User = get_user_model()

user = User.objects.get(username='poffermanns')
members = DepartmentMember.objects.filter(user=user).order_by('created_at')

print('=== Alle DepartmentMember Einträge für Patrick Offermanns ===')
print()

for m in members:
    print(f'ID {m.id}: {m.department.name} - {m.role.name}')
    print(f'  Aktiv: {m.is_active}, Primär: {m.is_primary}')
    print(f'  Erstellt: {m.created_at}')
    print()

print(f'Gesamt: {members.count()} Einträge')
