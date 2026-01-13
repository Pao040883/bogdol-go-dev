"""
Demo: Erstellt Faktur-Specialty und verknüpft mit Workorder-Permissions
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import Specialty, Department
from auth_user.permission_models import PermissionCode, PermissionMapping

print("🎯 DEMO: Faktur-Specialty mit Permissions")
print("=" * 60)

# 1. Finde oder erstelle Faktur-Specialty
print("\n1️⃣ Faktur-Specialty...")
try:
    # Versuche zuerst Department "Finanz- und Rechnungswesen" zu finden
    finanz_dept = Department.objects.filter(
        name__icontains='finanz'
    ).first()
    
    if not finanz_dept:
        print("  ℹ️ Kein Finanz-Department gefunden, nutze erstes Department")
        finanz_dept = Department.objects.first()
    
    if finanz_dept:
        print(f"  Department: {finanz_dept.name}")
        
        # Erstelle oder hole Faktur-Specialty
        faktur, created = Specialty.objects.get_or_create(
            code='FAKTUR',
            defaults={
                'name': 'Fakturierung',
                'description': 'Abrechnung und Fakturierung von Arbeitsscheinen',
                'department': finanz_dept,
                'display_order': 10,
                'is_active': True
            }
        )
        
        if created:
            print(f"  ✅ Faktur-Specialty erstellt: {faktur.name}")
        else:
            print(f"  ℹ️ Faktur-Specialty existiert: {faktur.name}")
            
        # 2. Verknüpfe mit Permissions
        print("\n2️⃣ Verknüpfe mit Workorder-Permissions...")
        
        workorder_permissions = [
            'can_view_workorders',
            'can_edit_workorders',
            'can_download_workorder_pdf',
            'can_cancel_workorder',
            'can_view_all_workorders'
        ]
        
        created_count = 0
        existing_count = 0
        
        for perm_code in workorder_permissions:
            try:
                permission = PermissionCode.objects.get(code=perm_code)
                mapping, created = PermissionMapping.objects.get_or_create(
                    entity_type='SPECIALTY',
                    entity_id=faktur.id,
                    permission=permission,
                    defaults={'is_active': True}
                )
                
                if created:
                    created_count += 1
                    print(f"  ✅ Neu: {perm_code}")
                else:
                    existing_count += 1
                    print(f"  ℹ️ Existiert: {perm_code}")
                    
            except PermissionCode.DoesNotExist:
                print(f"  ⚠️ Permission nicht gefunden: {perm_code}")
        
        print(f"\n📊 Ergebnis: {created_count} neu, {existing_count} existierend")
        
        # 3. Zeige finale Konfiguration
        print("\n3️⃣ Finale Konfiguration:")
        print(f"  Specialty: {faktur.name} (ID: {faktur.id}, Code: {faktur.code})")
        print(f"  Department: {faktur.department.name}")
        print(f"  Permissions:")
        
        mappings = PermissionMapping.objects.filter(
            entity_type='SPECIALTY',
            entity_id=faktur.id,
            is_active=True
        ).select_related('permission')
        
        for mapping in mappings:
            print(f"    - {mapping.permission.code}: {mapping.permission.name}")
        
        print("\n💡 Tipp:")
        print("  Weise jetzt einem User diese Specialty zu:")
        print(f"  1. Öffne /admin/users/")
        print(f"  2. Bearbeite User → Abteilungszuordnung")
        print(f"  3. Wähle Fachbereich: Fakturierung")
        print(f"  4. User hat jetzt automatisch Workorder-Rechte!")
        
    else:
        print("  ❌ Kein Department gefunden!")
        
except Exception as e:
    print(f"  ❌ Fehler: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✅ Demo abgeschlossen!")
