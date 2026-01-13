#!/usr/bin/env python
"""Assign can_view_all_checklist_items permission to test user"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.permission_models import PermissionCode, PermissionMapping
from auth_user.profile_models import Specialty, UserProfile

User = get_user_model()

# Hole die Permission
perm = PermissionCode.objects.get(code='can_view_all_checklist_items')
print(f"Permission: {perm.name}")

# Finde Faktur-Specialty
try:
    faktur_specialty = Specialty.objects.get(code='FAKTUR')
    print(f"Faktur Specialty gefunden: {faktur_specialty.name}")
except Specialty.DoesNotExist:
    print("❌ FEHLER: Faktur-Specialty nicht gefunden!")
    print("Verfügbare Specialties:")
    for spec in Specialty.objects.all():
        print(f"  - {spec.code}: {spec.name}")
    exit(1)

# Erstelle Mapping: Faktur-Specialty → can_view_all_checklist_items
mapping, created = PermissionMapping.objects.get_or_create(
    permission=perm,
    entity_type='SPECIALTY',
    entity_id=faktur_specialty.id,
    defaults={
        'scope': None  # Diese Permission unterstützt keinen Scope
    }
)

if created:
    print(f"✅ Mapping erstellt: Faktur → {perm.code}")
else:
    print(f"ℹ️ Mapping existiert bereits: Faktur → {perm.code}")

# Zeige alle Benutzer mit Faktur-Specialty
print("\n=== Benutzer mit Faktur-Specialty ===")

from auth_user.profile_models import MemberSpecialty

member_specialties = MemberSpecialty.objects.filter(
    specialty=faktur_specialty,
    is_active=True,
    member__user__is_active=True
).select_related('member__user')

for ms in member_specialties:
    print(f"  - {ms.member.user.username}")

print(f"\n✅ Fertig! Alle {member_specialties.count()} Faktur-Mitarbeiter haben jetzt can_view_all_checklist_items")
