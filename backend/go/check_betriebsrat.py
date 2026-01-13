#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import DepartmentMember, Department
from auth_user.models import CustomUser

print('=== DEPARTMENTS ===')
for d in Department.objects.all().order_by('id'):
    print(f'{d.id}: {d.name} (Company: {d.company.name if d.company else None}, Parent: {d.parent.name if d.parent else None})')

print('\n=== BETRIEBSRAT ===')
br_user = CustomUser.objects.filter(username='b.duric').first()
if br_user:
    br = DepartmentMember.objects.filter(user=br_user).first()
    if br:
        print(f'User: {br.user.username}')
        print(f'Department: {br.department.name}')
        print(f'Department ID: {br.department.id}')
        print(f'is_staff_position: {br.is_staff_position}')
        print(f'is_primary: {br.is_primary}')
    else:
        print('Keine DepartmentMember-Zuordnung gefunden!')
else:
    print('User b.duric nicht gefunden!')

print('\n=== GESELLSCHAFTER DEPARTMENT ===')
gesellschaft = Department.objects.filter(name__icontains='gesellschaft').first()
if gesellschaft:
    print(f'Department: {gesellschaft.name}')
    print(f'Department ID: {gesellschaft.id}')
    print(f'Company: {gesellschaft.company.name if gesellschaft.company else None}')
    print(f'Parent: {gesellschaft.parent.name if gesellschaft.parent else None}')
    
    print('\n  Members:')
    for member in DepartmentMember.objects.filter(department=gesellschaft, is_active=True):
        print(f'  - {member.user.username}: {member.role.name}, is_staff_position={member.is_staff_position}')
else:
    print('Gesellschafter Department nicht gefunden!')
