#!/usr/bin/env python
"""Test can_assign_workorders Permission"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.permission_models import PermissionMapping
from auth_user.permission_service import PermissionService
from auth_user.models import CustomUser

print('📋 Test: can_assign_workorders Permission\n')

poff = CustomUser.objects.get(username='poff')
perms = PermissionService.for_user(poff)

print(f'User: {poff.username}')
print(f'  can_view_workorders: {perms.has_permission("can_view_workorders")}')
print(f'  can_assign_workorders: {perms.has_permission("can_assign_workorders")}')

print(f'\n✅ Alle WORKORDER Permissions:')
all_perms = perms.get_all_permissions()
for p in sorted(all_perms):
    if 'workorder' in p:
        print(f'  • {p}')
