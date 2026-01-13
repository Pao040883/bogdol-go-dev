#!/usr/bin/env python
"""
Prüft welche Entitäten für Permission-Konfiguration verfügbar sind
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import Specialty, Department, DepartmentRole

print("=" * 60)
print("VERFÜGBARE ENTITÄTEN FÜR PERMISSION-KONFIGURATION")
print("=" * 60)

# Specialties
specialties = Specialty.objects.filter(is_active=True)
print(f"\n📦 FACHBEREICHE ({specialties.count()}):")
for s in specialties[:10]:
    dept_info = f" → {s.department.name}" if s.department else ""
    print(f"  • {s.name} ({s.code}){dept_info}")

# Departments
departments = Department.objects.filter(is_active=True)
print(f"\n🏢 ABTEILUNGEN ({departments.count()}):")
for d in departments[:10]:
    print(f"  • {d.name}")

# Roles
roles = DepartmentRole.objects.filter(is_active=True)
print(f"\n👥 ROLLEN ({roles.count()}):")
for r in roles[:10]:
    print(f"  • {r.name}")

print(f"\n{'='*60}")
if specialties.count() == 0 and departments.count() == 0 and roles.count() == 0:
    print("⚠️  KEINE ENTITÄTEN VORHANDEN!")
    print("Du musst zuerst Abteilungen, Rollen oder Fachbereiche anlegen,")
    print("bevor du Berechtigungen konfigurieren kannst.")
else:
    print("✅ Entitäten verfügbar - Permission-Konfiguration möglich!")
print("=" * 60)
