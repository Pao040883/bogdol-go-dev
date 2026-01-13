"""
Test-Script für das neue Scope-System
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.permission_models import PermissionCode, PermissionMapping
from auth_user.permission_service import PermissionService
from auth_user.models import CustomUser

print("=" * 60)
print("🔍 TEST: SCOPE-SYSTEM")
print("=" * 60)

# 1. Zeige alle Permissions mit Scope-Unterstützung
print("\n1️⃣ Permissions mit Scope-Unterstützung:")
print("-" * 60)
scope_perms = PermissionCode.objects.filter(supports_scope=True).order_by('code')
for perm in scope_perms:
    print(f"  ✅ {perm.code}")
    print(f"     Default Scope: {perm.default_scope}")
    print(f"     Name: {perm.name}")
    print()

# 2. Teste Permission Service mit einem User
print("\n2️⃣ Teste Permission Service:")
print("-" * 60)

# Nimm ersten User
test_user = CustomUser.objects.first()
if test_user:
    print(f"Test-User: {test_user.username}")
    print()
    
    perm_service = PermissionService.for_user(test_user)
    
    # Teste Workorder-Permissions
    print("📋 Arbeitsscheine-Permissions:")
    for perm_code in ['can_view_workorders', 'can_edit_workorders']:
        has_perm = perm_service.has_permission(perm_code)
        scope = perm_service.get_permission_scope(perm_code)
        print(f"  {perm_code}:")
        print(f"    Hat Permission: {has_perm}")
        print(f"    Scope: {scope}")
    
    print("\n📅 Abwesenheiten-Permissions:")
    for perm_code in ['can_view_absences', 'can_approve_absences']:
        has_perm = perm_service.has_permission(perm_code)
        scope = perm_service.get_permission_scope(perm_code)
        print(f"  {perm_code}:")
        print(f"    Hat Permission: {has_perm}")
        print(f"    Scope: {scope}")
else:
    print("⚠️ Kein Test-User gefunden")

# 3. Zeige Beispiel-Mappings
print("\n3️⃣ Beispiel Mappings mit Scope:")
print("-" * 60)
mappings_with_scope = PermissionMapping.objects.filter(
    permission__supports_scope=True,
    is_active=True
)[:5]

if mappings_with_scope.exists():
    for mapping in mappings_with_scope:
        effective_scope = mapping.get_effective_scope()
        print(f"  {mapping.entity_type} {mapping.entity_id} → {mapping.permission.code}")
        print(f"    Mapping Scope: {mapping.scope or '(nutzt default)'}")
        print(f"    Effective Scope: {effective_scope}")
        print()
else:
    print("  ℹ️ Noch keine Mappings mit Scope vorhanden")

print("\n" + "=" * 60)
print("✅ TEST ABGESCHLOSSEN")
print("=" * 60)
