#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

users = User.objects.filter(is_active=True)[:5]
print("Erste 5 aktive User:")
for u in users:
    print(f"  - {u.username}")
