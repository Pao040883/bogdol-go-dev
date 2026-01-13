#!/usr/bin/env python
"""Assign Faktur specialty to test user dkomsic"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.profile_models import Specialty, MemberSpecialty, UserProfile

User = get_user_model()

# Hole dkomsic
user = User.objects.get(username='dkomsic')
profile = user.userprofile
print(f"User: {user.username}")

# Hole Faktur-Specialty
faktur = Specialty.objects.get(code='FAKTUR')
print(f"Specialty: {faktur.name}")

# Hole oder erstelle eine aktive Membership (Department-Mitgliedschaft)
from auth_user.profile_models import DepartmentMembership
membership = profile.memberships.filter(is_active=True).first()

if not membership:
    print("❌ User hat keine aktive Department-Membership!")
    exit(1)

print(f"Membership: {membership.department.name}")

# Erstelle MemberSpecialty
ms, created = MemberSpecialty.objects.get_or_create(
    member=membership,
    specialty=faktur,
    defaults={
        'is_active': True,
        'is_primary': True
    }
)

if created:
    print(f"✅ Faktur-Specialty zugewiesen an {user.username}")
else:
    print(f"ℹ️ {user.username} hatte bereits Faktur-Specialty")

# Teste Permission
from auth_user.permission_service import PermissionService
perm_service = PermissionService.for_user(user)
has_perm = perm_service.has_permission('can_view_all_checklist_items')
print(f"\nPermission Check: can_view_all_checklist_items = {has_perm}")
