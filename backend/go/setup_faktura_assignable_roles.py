#!/usr/bin/env python
"""
Setup Script: Markiere Rollen als Faktura-zuweisbar
Service Manager sollen Faktura-Zuweisungen erhalten können
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import DepartmentRole

def setup_faktura_assignable_roles():
    """
    Setze can_receive_faktura_assignments=True für Service Manager
    """
    
    # Liste der Rollen-Codes die Faktura-Zuweisungen erhalten können
    assignable_role_codes = [
        'SM',  # Service Manager
        # Weitere Rollen hier hinzufügen falls nötig
    ]
    
    print("🔧 Setze Faktura-Zuweisungs-Flag für Rollen...")
    
    for role_code in assignable_role_codes:
        try:
            role = DepartmentRole.objects.get(code=role_code)
            if not role.can_receive_faktura_assignments:
                role.can_receive_faktura_assignments = True
                role.save()
                print(f"✅ {role.name} ({role_code}) kann jetzt Faktura-Zuweisungen erhalten")
            else:
                print(f"ℹ️  {role.name} ({role_code}) bereits konfiguriert")
        except DepartmentRole.DoesNotExist:
            print(f"⚠️  Rolle '{role_code}' nicht gefunden - bitte manuell erstellen")
    
    # Zeige alle konfigurierten Rollen
    print("\n📋 Alle Rollen die Faktura-Zuweisungen erhalten können:")
    assignable_roles = DepartmentRole.objects.filter(
        can_receive_faktura_assignments=True,
        is_active=True
    )
    
    if assignable_roles.exists():
        for role in assignable_roles:
            print(f"   • {role.name} ({role.code}) - Level {role.hierarchy_level}")
    else:
        print("   ⚠️  Keine Rollen konfiguriert!")
    
    print("\n✅ Setup abgeschlossen!")

if __name__ == '__main__':
    setup_faktura_assignable_roles()
