"""
Serializer für User Feature/Permission Abfrage
Gibt zurück, welche Features/Apps ein User sehen darf

✅ FLEXIBEL: Prüft gegen PermissionMapping statt Hardcoding
"""
from rest_framework import serializers
from .permission_service import PermissionService


class UserFeaturesSerializer(serializers.Serializer):
    """
    Gibt Feature-Flags für Frontend Dashboard zurück
    Prüft dynamisch gegen PermissionMapping
    
    ERWEITERT: Inkludiert Scope-Informationen für Permissions
    """
    # Apps
    can_view_sofo = serializers.SerializerMethodField()
    can_view_workorders = serializers.SerializerMethodField()
    can_view_work_tickets = serializers.SerializerMethodField()
    can_view_contacts = serializers.SerializerMethodField()
    can_view_absences = serializers.SerializerMethodField()
    
    # Workorder Permissions
    can_assign_workorders = serializers.SerializerMethodField()
    can_view_workorder_checklist = serializers.SerializerMethodField()
    can_manage_checklist_assignments = serializers.SerializerMethodField()
    can_toggle_all_checklist_items = serializers.SerializerMethodField()  # Toggle für Checkliste
    can_toggle_all_workorders = serializers.SerializerMethodField()  # Toggle für Arbeitsscheine
    can_download_workorder_pdf = serializers.SerializerMethodField()
    
    # Intranet
    can_view_chat = serializers.SerializerMethodField()
    can_view_organigramm = serializers.SerializerMethodField()
    
    # Auswertungen
    can_view_analytics = serializers.SerializerMethodField()
    
    # Admin
    can_view_admin = serializers.SerializerMethodField()
    can_view_users = serializers.SerializerMethodField()
    can_view_companies = serializers.SerializerMethodField()
    can_view_departments = serializers.SerializerMethodField()
    can_view_roles = serializers.SerializerMethodField()
    can_view_absence_types = serializers.SerializerMethodField()
    can_view_specialties = serializers.SerializerMethodField()
    can_view_ai_training = serializers.SerializerMethodField()
    can_view_permissions = serializers.SerializerMethodField()
    
    # External Links
    can_view_external_links = serializers.SerializerMethodField()
    
    # Scope-Informationen (NEU)
    permission_scopes = serializers.SerializerMethodField()
    
    def _get_permission_service(self, user):
        """Helper: Gibt PermissionService für User zurück"""
        if not hasattr(self, '_perm_service'):
            self._perm_service = PermissionService.for_user(user)
        return self._perm_service
    
    def get_can_view_sofo(self, user):
        """Sofortmeldungen"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_sofo')
    
    def get_can_view_workorders(self, user):
        """
        ✅ FLEXIBEL: Prüft PermissionMapping statt Hardcoding
        """
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_workorders')
    
    def get_can_view_work_tickets(self, user):
        """Work Tickets"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_work_tickets')
    
    def get_can_view_contacts(self, user):
        """Telefonbuch/Kontakte"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_contacts')
    
    def get_can_view_absences(self, user):
        """Abwesenheiten"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_absences')
    
    def get_can_assign_workorders(self, user):
        """Service Manager zuweisen / Arbeitsscheine zuweisen"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_assign_workorders')
    
    def get_can_view_workorder_checklist(self, user):
        """Arbeitsschein-Hakliste anzeigen"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_workorder_checklist')
    
    def get_can_manage_checklist_assignments(self, user):
        """Haklisten-Zuweisungen verwalten"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_checklist_assignments')
    
    def get_can_toggle_all_checklist_items(self, user):
        """Toggle: Alle Haklisten-Einträge anzeigen"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_toggle_all_checklist_items')
    
    def get_can_toggle_all_workorders(self, user):
        """Toggle: Alle Arbeitsscheine anzeigen"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_toggle_all_workorders')
    
    def get_can_download_workorder_pdf(self, user):
        """Arbeitsschein-PDFs herunterladen"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_download_workorder_pdf')
    
    def get_can_view_chat(self, user):
        """Chat/Messaging"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_chat')
    
    def get_can_view_organigramm(self, user):
        """Organigramm"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_organigramm')
    
    def get_can_view_analytics(self, user):
        """Auswertungen/Analytics"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_analytics')
    
    def get_can_view_admin(self, user):
        """Admin-Bereich"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_admin')
    
    def get_can_view_users(self, user):
        """User-Verwaltung"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_users')
    
    def get_can_view_companies(self, user):
        """Gesellschaften-Verwaltung"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_companies')
    
    def get_can_view_departments(self, user):
        """Abteilungs-Verwaltung"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_departments')
    
    def get_can_view_roles(self, user):
        """Rollen-Verwaltung"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_roles')
    
    def get_can_view_absence_types(self, user):
        """Abwesenheitsarten-Verwaltung"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_absence_types')
    
    def get_can_view_specialties(self, user):
        """Fachbereichs-Verwaltung"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_specialties')
    
    def get_can_view_ai_training(self, user):
        """KI-Training"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_ai_training')
    
    def get_can_view_permissions(self, user):
        """Permission-Verwaltung (NEU)"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_manage_permissions')
    
    def get_can_view_external_links(self, user):
        """Externe Links"""
        perm_service = self._get_permission_service(user)
        return perm_service.has_permission('can_view_external_links')
    
    def get_permission_scopes(self, user):
        """
        Gibt Scope-Informationen für alle scope-fähigen Permissions zurück
        
        Returns:
            dict: {permission_code: scope} z.B. {'can_view_workorders': 'ALL'}
        """
        perm_service = self._get_permission_service(user)
        scopes = {}
        
        # Liste aller scope-fähigen Permissions
        scope_permissions = [
            'can_view_workorders',
            'can_edit_workorders',
            'can_download_workorder_pdf',
            'can_cancel_workorder',
            'can_view_absences',
            'can_approve_absences',
            'can_manage_absences',
        ]
        
        for perm_code in scope_permissions:
            scope = perm_service.get_permission_scope(perm_code)
            if scope:  # Nur wenn User die Permission hat
                scopes[perm_code] = scope
        
        return scopes
