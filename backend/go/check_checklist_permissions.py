#!/usr/bin/env python
"""Check checklist permissions and assignments"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.permission_models import PermissionCode, PermissionMapping
from auth_user.permission_service import PermissionService
from workorders.models import RecurringWorkOrderChecklist

User = get_user_model()

# Finde alle Benutzer und zeige deren checklist-Scope
print("=== BENUTZER MIT CHECKLIST-BERECHTIGUNG ===")
users = User.objects.filter(is_active=True)[:10]

for user in users:
    perm_service = PermissionService.for_user(user)
    scope = perm_service.get_permission_scope('can_view_workorder_checklist')
    if scope:
        print(f'{user.username}:')
        print(f'  - Scope: {scope}')
        print(f'  - is_staff: {user.is_staff}')
        print(f'  - is_superuser: {user.is_superuser}')
        print()

# Zeige Checklist-Items und deren Zuweisungen
print("\n=== CHECKLIST ITEMS (erste 10) ===")
items = RecurringWorkOrderChecklist.objects.all()[:10]
for item in items:
    sm = item.service_manager.username if item.service_manager else 'None'
    ab = item.assigned_billing_user.username if item.assigned_billing_user else 'None'
    print(f'ID {item.id}: {item.object_number} | SM: {sm} | Faktur: {ab}')

print("\n=== PERMISSION-CODE ===")
perm_code = PermissionCode.objects.filter(code='can_view_workorder_checklist').first()
if perm_code:
    print(f'can_view_workorder_checklist: supports_scope={perm_code.supports_scope}, default_scope={perm_code.default_scope}')
