#!/usr/bin/env python
"""
Script zum Einrichten von Stabsstellen im Organigramm
- Betriebsrat (Bedra Duric)
- Weitere Stabsstellen falls vorhanden
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import DepartmentMember, Department, DepartmentRole
from auth_user.models import CustomUser

def setup_staff_positions():
    """Richte Stabsstellen korrekt ein"""
    
    print("=== STABSSTELLEN SETUP ===\n")
    
    # 1. Finde Gesellschafter Department
    gesellschaft = Department.objects.filter(name__icontains='gesellschaft').first()
    if not gesellschaft:
        print("❌ Gesellschafter Department nicht gefunden!")
        return
    
    print(f"✅ Gesellschafter Department gefunden: {gesellschaft.name} (ID: {gesellschaft.id})")
    
    # 2. Finde passende Rolle für Stabsstellen (meist "Mitarbeitende")
    staff_role = DepartmentRole.objects.filter(hierarchy_level=4).first()
    if not staff_role:
        staff_role = DepartmentRole.objects.filter(name__icontains='mitarbeit').first()
    
    if not staff_role:
        print("❌ Keine passende Rolle für Stabsstellen gefunden!")
        return
    
    print(f"✅ Rolle für Stabsstellen: {staff_role.name} (Level {staff_role.hierarchy_level})")
    
    # 3. Betriebsrat Setup
    print("\n--- Betriebsrat ---")
    br_user = CustomUser.objects.filter(username='b.duric').first()
    
    if not br_user:
        print("⚠️  User 'b.duric' nicht gefunden - überspringe Betriebsrat")
    else:
        # Prüfe ob bereits Member existiert
        existing = DepartmentMember.objects.filter(
            user=br_user,
            department=gesellschaft
        ).first()
        
        if existing:
            print(f"✓ Membership existiert bereits (ID: {existing.id})")
            # Update auf Stabsstelle
            if not existing.is_staff_position:
                existing.is_staff_position = True
                existing.position_title = 'Betriebsrat'
                existing.is_primary = True
                existing.save()
                print(f"✅ Aktualisiert auf Stabsstelle: {existing.user.get_full_name()}")
            else:
                print(f"✓ Bereits als Stabsstelle konfiguriert")
        else:
            # Erstelle neue Membership
            member = DepartmentMember.objects.create(
                user=br_user,
                department=gesellschaft,
                role=staff_role,
                position_title='Betriebsrat',
                is_staff_position=True,
                is_primary=True,
                is_active=True
            )
            print(f"✅ Betriebsrat erstellt: {member.user.get_full_name()}")
    
    # 4. Lösche das Betriebsrat-Department falls vorhanden
    print("\n--- Betriebsrat Department bereinigen ---")
    br_dept = Department.objects.filter(name__icontains='betriebsrat').first()
    if br_dept:
        # Verschiebe alle Members zu Gesellschafter
        members = DepartmentMember.objects.filter(department=br_dept)
        for member in members:
            print(f"  Verschiebe {member.user.get_full_name()} nach Gesellschafter")
            member.department = gesellschaft
            member.is_staff_position = True
            member.save()
        
        # Lösche Department
        br_dept.delete()
        print(f"✅ Betriebsrat-Department gelöscht")
    else:
        print("✓ Kein separates Betriebsrat-Department gefunden")
    
    # 5. Zeige alle Stabsstellen
    print("\n=== AKTUELLE STABSSTELLEN ===")
    staff_members = DepartmentMember.objects.filter(
        department=gesellschaft,
        is_staff_position=True,
        is_active=True
    )
    
    if staff_members.exists():
        for member in staff_members:
            print(f"  • {member.user.get_full_name()} - {member.position_title or member.role.name}")
    else:
        print("  Keine Stabsstellen gefunden")
    
    print("\n✅ Setup abgeschlossen!")
    print("\nWICHTIG: Bitte Frontend refreshen (Ctrl+R) um Änderungen zu sehen")


if __name__ == '__main__':
    setup_staff_positions()
