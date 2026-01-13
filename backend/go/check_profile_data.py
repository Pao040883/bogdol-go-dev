import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import UserProfile

profiles = UserProfile.objects.filter(is_searchable=True)

print('\n📋 Profile mit gespeicherten Daten:\n')
for p in profiles:
    print(f'\n{p.user.username}:')
    print(f'  Responsibilities: {p.responsibilities or "---"}')
    print(f'  Expertise: {p.expertise_areas or "---"}')
    print(f'  Job Title: {p.job_title or "---"}')
    print(f'  Department: {p.department.name if p.department else "---"}')
