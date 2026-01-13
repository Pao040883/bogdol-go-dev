"""
Scope-basierte QuerySet Filter mit Business-Logic
Kombiniert Permission-Scopes mit app-spezifischen Zuweisungen
"""
from django.db.models import Q
from .permission_service import PermissionService
from .profile_models import FakturaAssignment


class ScopeQuerySetMixin:
    """
    Mixin für ViewSets um Scope-basierte Filterung zu implementieren
    Kombiniert Permission-Scope mit Business-Logic (Assignments, Vertretung, etc.)
    """
    
    @staticmethod
    def filter_workorders_by_scope(queryset, user, permission_service=None):
        """
        Filtert Workorders basierend auf Permission-Scope + Business-Logic
        
        Args:
            queryset: WorkOrder QuerySet
            user: Aktueller User
            permission_service: Optional PermissionService Instanz
        
        Returns:
            Gefiltertes QuerySet
        
        Business-Logic:
        - OWN: Eigene erstellte + zugewiesene Arbeitsscheine (FakturaAssignment)
        - DEPARTMENT: Abteilungs-Arbeitsscheine + zugewiesene
        - ALL: Alle Arbeitsscheine
        """
        if user.is_superuser or user.is_staff:
            return queryset
        
        if permission_service is None:
            permission_service = PermissionService.for_user(user)
        
        # Prüfe ob User die Permission überhaupt hat
        if not permission_service.has_permission('can_view_workorders'):
            return queryset.none()
        
        scope = permission_service.get_permission_scope('can_view_workorders')
        
        if not scope or scope == 'NONE':
            # Keine Permission oder NONE Scope → leeres QuerySet
            return queryset.none()
        
        if scope == 'ALL':
            # Alle Arbeitsscheine sehen
            return queryset
        
        # Basis-Filter nach Scope
        if scope == 'OWN':
            # Eigene erstellte Arbeitsscheine
            q = Q(created_by=user)
        elif scope == 'DEPARTMENT':
            # Arbeitsscheine der eigenen Abteilung(en)
            user_departments = user.department_memberships.filter(
                is_active=True
            ).values_list('department_id', flat=True)
            q = Q(department_id__in=user_departments)
        else:
            # Fallback: leeres QuerySet
            return queryset.none()
        
        # Business-Logic: Faktura-Assignments hinzufügen
        # Faktura-MAs sehen zusätzlich die Arbeitsscheine ihrer zugewiesenen Service-Manager
        assigned_sm_ids = FakturaAssignment.objects.filter(
            faktura_processor=user,
            is_active=True
        ).values_list('employee_id', flat=True)
        
        if assigned_sm_ids:
            # Erweitere QuerySet: Original ODER von zugewiesenen SMs erstellt
            q |= Q(created_by__in=assigned_sm_ids)
        
        return queryset.filter(q).distinct()
    
    @staticmethod
    def filter_absences_by_scope(queryset, user, permission_service=None):
        """
        Filtert Absences basierend auf Permission-Scope + Business-Logic
        
        Business-Logic:
        - OWN: Eigene Abwesenheiten
        - DEPARTMENT: Eigene + direkte Untergebene + zugewiesene (HR)
        - ALL: Alle Abwesenheiten
        """
        if user.is_superuser or user.is_staff:
            return queryset
        
        if permission_service is None:
            permission_service = PermissionService.for_user(user)
        
        # Prüfe ob User die Permission überhaupt hat
        if not permission_service.has_permission('can_view_absences'):
            return queryset.none()
        
        scope = permission_service.get_permission_scope('can_view_absences')
        
        if not scope or scope == 'NONE':
            return queryset.none()
        
        if scope == 'ALL':
            return queryset
        
        # Basis: Eigene Abwesenheiten
        q = Q(user=user)
        
        if scope in ['DEPARTMENT', 'ALL']:
            # Direkte Untergebene (als Vorgesetzter)
            if hasattr(user, 'profile') and user.profile:
                subordinates = user.profile.get_subordinates()
                if subordinates.exists():
                    q |= Q(user__in=subordinates)
            
            # Zugewiesene Mitarbeiter (HR-Assignment)
            try:
                from absences.models import HRAssignment
                assigned_employees = HRAssignment.objects.filter(
                    hr_processor=user,
                    is_active=True
                ).values_list('employee_id', flat=True)
                
                if assigned_employees:
                    q |= Q(user__in=assigned_employees)
            except ImportError:
                pass
            
            # Vertretungsfälle (wo ich Vertretung bin)
            try:
                from absences.models import SubstituteAssignment
                substituted_users = SubstituteAssignment.objects.filter(
                    substitute=user,
                    is_active=True
                ).values_list('original_user_id', flat=True)
                
                if substituted_users:
                    q |= Q(user__in=substituted_users)
            except ImportError:
                pass
        
        return queryset.filter(q).distinct()
    
    @staticmethod
    def filter_sofortmeldungen_by_scope(queryset, user, permission_service=None):
        """
        Filtert Sofortmeldungen basierend auf Permission-Scope + Business-Logic
        
        Business-Logic:
        - OWN: Eigene erstellte Sofortmeldungen
        - DEPARTMENT: Eigene + Abteilungs-Sofortmeldungen
        - ALL: Alle Sofortmeldungen
        """
        if user.is_superuser or user.is_staff:
            return queryset
        
        if permission_service is None:
            permission_service = PermissionService.for_user(user)
        
        # Prüfe ob User die Permission überhaupt hat
        if not permission_service.has_permission('can_view_sofo'):
            return queryset.none()
        
        scope = permission_service.get_permission_scope('can_view_sofo')
        
        if not scope or scope == 'NONE':
            return queryset.none()
        
        if scope == 'ALL':
            return queryset
        
        # Basis: Eigene Sofortmeldungen
        q = Q(created_by=user)
        
        if scope in ['DEPARTMENT', 'ALL']:
            # Abteilungs-Sofortmeldungen
            user_departments = user.department_memberships.filter(
                is_active=True
            ).values_list('department_id', flat=True)
            
            if user_departments:
                # Sofortmeldungen der eigenen Abteilung
                q |= Q(department_id__in=user_departments)
        
            # Business-Logic: HR-Assignments (ähnlich wie Absences)
            try:
                from absences.models import HRAssignment
                assigned_employees = HRAssignment.objects.filter(
                    hr_processor=user,
                    is_active=True
                ).values_list('employee_id', flat=True)
                
                if assigned_employees.exists():
                    # Sofortmeldungen von zugewiesenen Mitarbeitern
                    q |= Q(created_by__id__in=assigned_employees)
            except ImportError:
                pass
        
        return queryset.filter(q).distinct()


def get_queryset_for_scope(queryset, user, permission_code, app_name=None):
    """
    Generische Funktion für Scope-basierte Filterung
    
    Args:
        queryset: Basis QuerySet
        user: Aktueller User
        permission_code: Permission Code (z.B. 'can_view_workorders')
        app_name: Optional App-Name für spezifische Logik
    
    Returns:
        Gefiltertes QuerySet
    """
    if user.is_superuser or user.is_staff:
        return queryset
    
    perm_service = PermissionService.for_user(user)
    
    # Prüfe Permission
    if not perm_service.has_permission(permission_code):
        return queryset.none()
    
    # Hole Scope
    scope = perm_service.get_permission_scope(permission_code)
    
    if not scope or scope == 'NONE':
        return queryset.none()
    
    if scope == 'ALL':
        return queryset
    
    # App-spezifische Filter
    if 'workorder' in permission_code.lower():
        return ScopeQuerySetMixin.filter_workorders_by_scope(queryset, user, perm_service)
    elif 'absence' in permission_code.lower():
        return ScopeQuerySetMixin.filter_absences_by_scope(queryset, user, perm_service)
    elif 'sofo' in permission_code.lower():
        return ScopeQuerySetMixin.filter_sofortmeldungen_by_scope(queryset, user, perm_service)
    
    # Fallback: Standard-Scope-Filter ohne Business-Logic
    if scope == 'OWN':
        return queryset.filter(created_by=user)
    elif scope == 'DEPARTMENT':
        user_departments = user.department_memberships.filter(
            is_active=True
        ).values_list('department_id', flat=True)
        return queryset.filter(department_id__in=user_departments)
    
    return queryset.none()
