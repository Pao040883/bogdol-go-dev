#!/usr/bin/env python
"""
Setup Script für Standard-Organisationsrollen
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import DepartmentRole


def create_roles():
    """Erstellt Standard-Rollen für beide Organisationstypen"""
    
    roles_data = [
        # Verwaltungsbereich
        {
            'name': 'Geschäftsführer',
            'code': 'GF',
            'hierarchy_level': 1,
            'org_type': 'administration',
            'color': '#dc2626',  # Rot
            'description': 'Geschäftsführung / CEO'
        },
        {
            'name': 'Abteilungsleiter',
            'code': 'AL',
            'hierarchy_level': 2,
            'org_type': 'administration',
            'color': '#ea580c',  # Orange
            'description': 'Leitung einer Abteilung'
        },
        {
            'name': 'Teamleiter',
            'code': 'TL',
            'hierarchy_level': 3,
            'org_type': 'administration',
            'color': '#ca8a04',  # Gelb
            'description': 'Leitung eines Teams'
        },
        {
            'name': 'Mitarbeitende',
            'code': 'MA',
            'hierarchy_level': 4,
            'org_type': 'administration',
            'color': '#16a34a',  # Grün
            'description': 'Mitarbeitende ohne Führungsverantwortung'
        },
        
        # Betrieb
        {
            'name': 'Geschäftsführer',
            'code': 'GF_OPS',
            'hierarchy_level': 1,
            'org_type': 'operations',
            'color': '#dc2626',  # Rot
            'description': 'Geschäftsführung / CEO'
        },
        {
            'name': 'Bereichsleitung',
            'code': 'BL',
            'hierarchy_level': 2,
            'org_type': 'operations',
            'color': '#ea580c',  # Orange
            'description': 'Leitung eines Bereichs'
        },
        {
            'name': 'Service Manager',
            'code': 'SM',
            'hierarchy_level': 3,
            'org_type': 'operations',
            'color': '#ca8a04',  # Gelb
            'description': 'Service Manager / Koordination'
        },
        {
            'name': 'Vorarbeiter',
            'code': 'VA',
            'hierarchy_level': 4,
            'org_type': 'operations',
            'color': '#16a34a',  # Grün
            'description': 'Vorarbeiter / Teamkoordination'
        },
        
        # Gemeinsame Rollen
        {
            'name': 'Assistenz',
            'code': 'ASS',
            'hierarchy_level': 99,
            'org_type': 'both',
            'color': '#6366f1',  # Indigo
            'description': 'Assistenz / Support-Rolle'
        },
        {
            'name': 'Praktikant',
            'code': 'PRAK',
            'hierarchy_level': 99,
            'org_type': 'both',
            'color': '#8b5cf6',  # Lila
            'description': 'Praktikant / Trainee'
        },
    ]
    
    created_count = 0
    updated_count = 0
    
    for role_data in roles_data:
        role, created = DepartmentRole.objects.update_or_create(
            code=role_data['code'],
            defaults={
                'name': role_data['name'],
                'hierarchy_level': role_data['hierarchy_level'],
                'org_type': role_data['org_type'],
                'color': role_data['color'],
                'description': role_data['description'],
                'is_active': True
            }
        )
        
        if created:
            created_count += 1
            print(f"✓ Erstellt: {role.name} ({role.code}) - Level {role.hierarchy_level}")
        else:
            updated_count += 1
            print(f"↻ Aktualisiert: {role.name} ({role.code})")
    
    print(f"\n{'='*60}")
    print(f"Fertig! {created_count} Rollen erstellt, {updated_count} aktualisiert")
    print(f"Gesamt: {DepartmentRole.objects.count()} Rollen im System")
    print(f"{'='*60}")


if __name__ == '__main__':
    print("Erstelle Standard-Organisationsrollen...\n")
    create_roles()
