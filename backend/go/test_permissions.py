"""Test Permission System"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.permission_models import PermissionCode, PermissionMapping
from auth_user.permission_service import PermissionService
from django.contrib.auth import get_user_model

User = get_user_model()

print("🧪 PERMISSION SYSTEM TEST")
print("=" * 60)

# Test 1: PermissionCodes
print("\n1️⃣ PermissionCodes (Workorder):")
workorder_perms = PermissionCode.objects.filter(category='WORKORDER').order_by('display_order')
for p in workorder_perms:
    print(f"  ✅ {p.code}: {p.name}")

# Test 2: PermissionMappings
print("\n2️⃣ PermissionMappings:")
mappings = PermissionMapping.objects.filter(is_active=True)
if mappings.exists():
    for m in mappings:
        print(f"  ✅ {m.get_entity_type_display()} {m.entity_id} → {m.permission.code}")
else:
    print("  ℹ️ Keine Mappings gefunden (normal, wenn Specialties noch nicht konfiguriert)")

# Test 3: PermissionService für Test-User
print("\n3️⃣ PermissionService Test:")
try:
    test_user = User.objects.filter(is_superuser=False).first()
    if test_user:
        perms = PermissionService.for_user(test_user)
        print(f"  User: {test_user.username}")
        print(f"  Full Access: {perms.has_full_access()}")
        print(f"  can_view_workorders: {perms.has_permission('can_view_workorders')}")
        print(f"  can_view_absences: {perms.has_permission('can_view_absences')}")
    else:
        print("  ℹ️ Kein Test-User gefunden")
except Exception as e:
    print(f"  ⚠️ Fehler: {e}")

# Test 4: Statistik
print("\n4️⃣ Statistik:")
print(f"  PermissionCodes: {PermissionCode.objects.filter(is_active=True).count()}")
print(f"  PermissionMappings: {PermissionMapping.objects.filter(is_active=True).count()}")

print("\n" + "=" * 60)
print("✅ Test abgeschlossen!")
