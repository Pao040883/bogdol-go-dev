#!/usr/bin/env python
"""Test Script für Profile-Funktionalität"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

print("=" * 50)
print("USER PROFILE TEST")
print("=" * 50)

u = User.objects.first()
if u:
    print(f"\n✓ User: {u.username}")
    print(f"✓ Full Name: {u.get_full_name()}")
    print(f"✓ Hat Profile: {hasattr(u, 'profile')}")
    print(f"✓ Hat Presence: {hasattr(u, 'presence')}")
    
    if hasattr(u, 'profile'):
        p = u.profile
        print(f"\n--- PROFILE DATA ---")
        print(f"  Phone: {p.phone_number}")
        print(f"  Job Title: {p.job_title}")
        print(f"  Department: {p.department}")
        print(f"  Vacation: {p.vacation_entitlement} days")
    
    if hasattr(u, 'presence'):
        pr = u.presence
        print(f"\n--- PRESENCE DATA ---")
        print(f"  Status: {pr.status}")
        print(f"  Is Online: {u.is_online}")
    
    print(f"\n--- PROPERTIES (Backward Compat) ---")
    print(f"  u.online_status: {u.online_status}")
    print(f"  u.is_supervisor: {u.is_supervisor}")
else:
    print("❌ Keine User gefunden")

print("\n" + "=" * 50)
