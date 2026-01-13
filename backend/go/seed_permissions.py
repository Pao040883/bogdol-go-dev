"""
Seeding-Script für Permission System
Erstellt Default PermissionCodes und initiale Mappings
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.permission_models import PermissionCode, PermissionMapping
from auth_user.profile_models import Specialty, DepartmentRole


def create_permission_codes():
    """Erstellt alle PermissionCodes"""
    
    permissions = [
        # Apps & Features (keine Scope-Einschränkung)
        {
            'code': 'can_view_sofo',
            'name': 'Sofortmeldungen anzeigen',
            'description': 'Berechtigung zum Anzeigen der Sofortmeldungs-App',
            'category': 'APP',
            'display_order': 10,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        
        # Arbeitsscheine - mit Scope-Unterstützung
        {
            'code': 'can_view_workorders',
            'name': 'Arbeitsscheine anzeigen',
            'description': 'Berechtigung zum Anzeigen von Arbeitsscheinen',
            'category': 'WORKORDER',
            'display_order': 20,
            'supports_scope': True,
            'default_scope': 'OWN'  # Standard: nur eigene
        },
        {
            'code': 'can_edit_workorders',
            'name': 'Arbeitsscheine bearbeiten',
            'description': 'Berechtigung zum Bearbeiten von Arbeitsscheinen (O-/P-Nummern)',
            'category': 'WORKORDER',
            'display_order': 21,
            'supports_scope': True,
            'default_scope': 'OWN'  # Standard: nur eigene
        },
        {
            'code': 'can_download_workorder_pdf',
            'name': 'AS-PDF herunterladen',
            'description': 'Berechtigung zum Herunterladen von Arbeitsschein-PDFs',
            'category': 'WORKORDER',
            'display_order': 22,
            'supports_scope': True,
            'default_scope': 'OWN'
        },
        {
            'code': 'can_cancel_workorder',
            'name': 'Arbeitsscheine stornieren',
            'description': 'Berechtigung zum Stornieren von Arbeitsscheinen',
            'category': 'WORKORDER',
            'display_order': 23,
            'supports_scope': True,
            'default_scope': 'OWN'
        },
        {
            'code': 'can_assign_workorders',
            'name': 'Service Manager zuweisen',
            'description': 'Berechtigung zum Zuweisen von Arbeitsscheinen an Service Manager',
            'category': 'WORKORDER',
            'display_order': 24,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_workorder_checklist',
            'name': 'Arbeitsschein-Hakliste anzeigen',
            'description': 'Berechtigung zum Anzeigen der Arbeitsschein-Hakliste (Scope: OWN=eigene, DEPARTMENT=Abteilung, ALL=alle)',
            'category': 'WORKORDER',
            'display_order': 25,
            'supports_scope': True,
            'default_scope': 'OWN'
        },
        {
            'code': 'can_toggle_all_workorders',
            'name': 'Arbeitsscheine: Toggle "Alle anzeigen"',
            'description': 'Berechtigung zum Umschalten zwischen "Nur eigene" und "Alle Arbeitsscheine" (unabhängig vom Scope)',
            'category': 'WORKORDER',
            'display_order': 26,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_toggle_all_checklist_items',
            'name': 'Hakliste: Toggle "Alle anzeigen"',
            'description': 'Berechtigung zum Umschalten zwischen "Nur eigene" und "Alle Haklisten-Einträge" (unabhängig vom Scope)',
            'category': 'WORKORDER',
            'display_order': 27,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_manage_checklist_assignments',
            'name': 'Hakliste-Zuweisungen verwalten',
            'description': 'Berechtigung zum Zuweisen von Service Manager und Faktur-Mitarbeitern',
            'category': 'WORKORDER',
            'display_order': 28,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        
        # Work Tickets
        {
            'code': 'can_view_work_tickets',
            'name': 'Work-Tickets anzeigen',
            'description': 'Berechtigung zum Anzeigen von Work-Tickets',
            'category': 'APP',
            'display_order': 30,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_contacts',
            'name': 'Mitarbeiterverzeichnis anzeigen',
            'description': 'Berechtigung zum Anzeigen des Mitarbeiterverzeichnisses',
            'category': 'APP',
            'display_order': 40,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        
        # Abwesenheiten - mit Scope-Unterstützung
        {
            'code': 'can_view_absences',
            'name': 'Abwesenheiten anzeigen',
            'description': 'Berechtigung zum Anzeigen von Abwesenheiten',
            'category': 'ABSENCE',
            'display_order': 50,
            'supports_scope': True,
            'default_scope': 'OWN'  # Standard: nur eigene
        },
        {
            'code': 'can_approve_absences',
            'name': 'Abwesenheiten genehmigen',
            'description': 'Berechtigung zum Genehmigen von Abwesenheiten',
            'category': 'ABSENCE',
            'display_order': 51,
            'supports_scope': True,
            'default_scope': 'DEPARTMENT'  # Standard: eigene Abteilung
        },
        {
            'code': 'can_manage_absences',
            'name': 'Abwesenheiten verwalten',
            'description': 'Berechtigung zum Bearbeiten/Löschen von Abwesenheiten (HR)',
            'category': 'ABSENCE',
            'display_order': 52,
            'supports_scope': True,
            'default_scope': 'ALL'  # HR verwaltet alle
        },
        
        # Intranet (keine Scope-Einschränkung)
        {
            'code': 'can_view_chat',
            'name': 'Chat anzeigen',
            'description': 'Berechtigung zum Anzeigen des Chats',
            'category': 'APP',
            'display_order': 60,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_organigramm',
            'name': 'Organigramm anzeigen',
            'description': 'Berechtigung zum Anzeigen des Organigramms',
            'category': 'APP',
            'display_order': 70,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        
        # Auswertungen
        {
            'code': 'can_view_analytics',
            'name': 'Auswertungen anzeigen',
            'description': 'Berechtigung zum Anzeigen von Analytics/Auswertungen',
            'category': 'ANALYTICS',
            'display_order': 80,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        
        # Admin (keine Scope-Einschränkung - Admin ist Admin)
        {
            'code': 'can_view_admin',
            'name': 'Admin-Bereich anzeigen',
            'description': 'Berechtigung zum Zugriff auf Admin-Bereich',
            'category': 'ADMIN',
            'display_order': 90,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_users',
            'name': 'Benutzerverwaltung anzeigen',
            'description': 'Berechtigung zur Benutzerverwaltung',
            'category': 'USER',
            'display_order': 91,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_manage_users',
            'name': 'Benutzer verwalten',
            'description': 'Berechtigung zum Erstellen/Bearbeiten/Löschen von Benutzern',
            'category': 'USER',
            'display_order': 92,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_companies',
            'name': 'Gesellschaften verwalten',
            'description': 'Berechtigung zur Verwaltung von Gesellschaften',
            'category': 'DEPARTMENT',
            'display_order': 93,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_departments',
            'name': 'Abteilungen verwalten',
            'description': 'Berechtigung zur Verwaltung von Abteilungen',
            'category': 'DEPARTMENT',
            'display_order': 94,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_roles',
            'name': 'Rollen verwalten',
            'description': 'Berechtigung zur Verwaltung von Rollen',
            'category': 'DEPARTMENT',
            'display_order': 95,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_absence_types',
            'name': 'Abwesenheitsarten verwalten',
            'description': 'Berechtigung zur Verwaltung von Abwesenheitsarten',
            'category': 'ADMIN',
            'display_order': 96,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_specialties',
            'name': 'Fachbereiche verwalten',
            'description': 'Berechtigung zur Verwaltung von Fachbereichen',
            'category': 'DEPARTMENT',
            'display_order': 97,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_view_ai_training',
            'name': 'KI-Training verwalten',
            'description': 'Berechtigung zur Verwaltung von KI-Trainings-Daten',
            'category': 'ADMIN',
            'display_order': 98,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        {
            'code': 'can_manage_permissions',
            'name': 'Berechtigungen verwalten',
            'description': 'Berechtigung zur Konfiguration von Berechtigungen',
            'category': 'ADMIN',
            'display_order': 99,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
        
        # External Links
        {
            'code': 'can_view_external_links',
            'name': 'Externe Links anzeigen',
            'description': 'Berechtigung zum Anzeigen externer Links',
            'category': 'APP',
            'display_order': 100,
            'supports_scope': False,
            'default_scope': 'NONE'
        },
    ]
    
    created_count = 0
    updated_count = 0
    
    for perm_data in permissions:
        perm, created = PermissionCode.objects.update_or_create(
            code=perm_data['code'],
            defaults={
                'name': perm_data['name'],
                'description': perm_data.get('description', ''),
                'category': perm_data.get('category', 'OTHER'),
                'display_order': perm_data.get('display_order', 0),
                'supports_scope': perm_data.get('supports_scope', False),
                'default_scope': perm_data.get('default_scope', 'NONE'),
                'is_active': True
            }
        )
        
        if created:
            created_count += 1
            print(f"  ✅ Erstellt: {perm.code}")
        else:
            updated_count += 1
            print(f"  🔄 Aktualisiert: {perm.code}")
    
    print(f"\n📊 PermissionCodes: {created_count} erstellt, {updated_count} aktualisiert")


def create_default_mappings():
    """Erstellt Default-Mappings basierend auf BERECHTIGUNGSKONZEPT.md"""
    
    print("\n🔗 Erstelle Default Permission Mappings...")
    
    # Faktur-Specialty → Workorder Permissions
    try:
        faktur_specialty = Specialty.objects.get(code='FAKTUR')
        
        faktur_permissions = [
            'can_view_workorders',
            'can_edit_workorders',
            'can_download_workorder_pdf',
            'can_cancel_workorder',
            'can_view_all_workorders',
            'can_assign_workorders',
            'can_view_workorder_checklist',  # Mit Scope=ALL für Faktur-Leads
            'can_manage_checklist_assignments'
        ]
        
        created_count = 0
        for perm_code in faktur_permissions:
            try:
                permission = PermissionCode.objects.get(code=perm_code)
                mapping, created = PermissionMapping.objects.get_or_create(
                    entity_type='SPECIALTY',
                    entity_id=faktur_specialty.id,
                    permission=permission,
                    defaults={'is_active': True}
                )
                if created:
                    created_count += 1
                    print(f"  ✅ Faktur → {perm_code}")
            except PermissionCode.DoesNotExist:
                print(f"  ⚠️ Permission nicht gefunden: {perm_code}")
        
        print(f"\n📊 Faktur Mappings: {created_count} erstellt")
        
    except Specialty.DoesNotExist:
        print("  ⚠️ Faktur-Specialty nicht gefunden (Code: FAKTUR)")
    
    # HR-Specialty → Absence Permissions
    try:
        hr_specialty = Specialty.objects.filter(code__in=['HR', 'PERSONAL']).first()
        
        if hr_specialty:
            hr_permissions = [
                'can_view_absences',
                'can_approve_absences',
                'can_manage_absences'
            ]
            
            created_count = 0
            for perm_code in hr_permissions:
                try:
                    permission = PermissionCode.objects.get(code=perm_code)
                    mapping, created = PermissionMapping.objects.get_or_create(
                        entity_type='SPECIALTY',
                        entity_id=hr_specialty.id,
                        permission=permission,
                        defaults={'is_active': True}
                    )
                    if created:
                        created_count += 1
                        print(f"  ✅ HR → {perm_code}")
                except PermissionCode.DoesNotExist:
                    print(f"  ⚠️ Permission nicht gefunden: {perm_code}")
            
            print(f"\n📊 HR Mappings: {created_count} erstellt")
        else:
            print("  ⚠️ HR-Specialty nicht gefunden (Code: HR oder PERSONAL)")
            
    except Exception as e:
        print(f"  ⚠️ Fehler bei HR-Mappings: {e}")
    
    # Alle Users: Basis-Permissions
    # (Wird über Frontend Default-Config gesteuert, nicht hier)


if __name__ == '__main__':
    print("🌱 Seeding Permission System...")
    print("=" * 60)
    
    print("\n1️⃣ Erstelle PermissionCodes...")
    create_permission_codes()
    
    print("\n2️⃣ Erstelle Default Mappings...")
    create_default_mappings()
    
    print("\n" + "=" * 60)
    print("✅ Seeding abgeschlossen!")
    
    # Statistik
    total_codes = PermissionCode.objects.filter(is_active=True).count()
    total_mappings = PermissionMapping.objects.filter(is_active=True).count()
    print(f"\n📊 Gesamt: {total_codes} PermissionCodes, {total_mappings} Mappings")
