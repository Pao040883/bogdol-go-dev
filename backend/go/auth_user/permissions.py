"""
Permission Service - Zentraler Service für strukturbasierte Berechtigungen
"""
from django.utils import timezone
from django.db.models import Q


class PermissionService:
    """Zentraler Service für strukturbasierte Berechtigungen"""
    
    def __init__(self, user):
        self.user = user
        self._cache = {}  # Request-Level Cache
    
    # ===== SUPERUSER/GF BYPASS =====
    
    def has_full_access(self) -> bool:
        """GF und Superuser dürfen alles"""
        if self.user.is_superuser or self.user.is_staff:
            return True
        
        # Check GF-Rolle
        cache_key = 'has_gf_role'
        if cache_key not in self._cache:
            self._cache[cache_key] = self.user.department_memberships.filter(
                is_active=True,
                role__code='GF'
            ).exists()
        
        return self._cache[cache_key]
    
    # ===== FACHBEREICH-CHECKS =====
    
    def get_user_specialties(self, department=None, active_only=True):
        """Gibt alle Fachbereiche des Users zurück"""
        from .profile_models import MemberSpecialty
        
        cache_key = f'specialties_{department}_{active_only}'
        
        if cache_key not in self._cache:
            memberships = self.user.department_memberships.all()
            
            if department:
                memberships = memberships.filter(department=department)
            if active_only:
                memberships = memberships.filter(is_active=True)
            
            specialty_assignments = MemberSpecialty.objects.filter(
                member__in=memberships,
                is_active=True
            ).select_related('specialty')
            
            self._cache[cache_key] = [
                assignment.specialty 
                for assignment in specialty_assignments
            ]
        
        return self._cache[cache_key]
    
    def has_specialty(self, specialty_code: str) -> bool:
        """Prüft ob User einen Fachbereich hat"""
        if self.has_full_access():
            return True
        
        specialties = self.get_user_specialties()
        return any(s.code == specialty_code for s in specialties)
    
    def has_specialty_in_department(self, specialty_id: int, department_id: int = None) -> bool:
        """Prüft ob User spezifischen Fachbereich hat"""
        if self.has_full_access():
            return True
        
        specialties = self.get_user_specialties(department=department_id)
        return any(s.id == specialty_id for s in specialties)
    
    # ===== VERTRETUNGS-CHECKS =====
    
    def get_active_substitutions(self, date=None):
        """Gibt aktive Vertretungen zurück (inkl. transitive Kette)"""
        from .profile_models import SubstituteAssignment
        from absences.models import Absence
        
        if date is None:
            date = timezone.now().date()
        
        cache_key = f'substitutions_{date}'
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # Direkte Vertretungen
        direct = SubstituteAssignment.objects.filter(
            substitute_user=self.user,
            is_active=True,
            absence__start_date__lte=date,
            absence__end_date__gte=date,
            absence__status__in=[Absence.APPROVED, Absence.HR_PROCESSED]
        ).select_related('original_user', 'absence', 'substitute_user')
        
        substitutions = list(direct)
        
        # Transitive Vertretungen (A→B→C)
        # Wenn User B jemanden vertritt (A), und jemand anders (C) vertritt B,
        # dann erbt C auch As Rechte
        for sub in direct:
            # Prüfe ob der abwesende User (A) selbst jemanden vertritt
            transitive = SubstituteAssignment.objects.filter(
                substitute_user=sub.original_user,
                is_active=True,
                absence__start_date__lte=date,
                absence__end_date__gte=date,
                absence__status__in=[Absence.APPROVED, Absence.HR_PROCESSED]
            ).select_related('original_user', 'absence', 'substitute_user')
            
            substitutions.extend(list(transitive))
        
        self._cache[cache_key] = substitutions
        return substitutions
    
    def is_substituting_for(self, user, specialty=None, date=None):
        """Prüft ob aktueller User für anderen User vertritt"""
        if self.has_full_access():
            return True
        
        substitutions = self.get_active_substitutions(date)
        
        for sub in substitutions:
            if sub.original_user == user:
                if specialty:
                    # Prüfe ob Specialty in Vertretung enthalten
                    if sub.specialties.exists():
                        return sub.specialties.filter(id=specialty.id).exists()
                return True
        
        return False
    
    def get_substituted_users(self, date=None):
        """Gibt Liste der Users zurück die vom aktuellen User vertreten werden"""
        substitutions = self.get_active_substitutions(date)
        return [sub.original_user for sub in substitutions]
    
    # ===== ARBEITSSCHEIN-CHECKS (ERWEITERT) =====
    
    def can_view_workorder(self, workorder) -> bool:
        """
        Darf User Arbeitsschein sehen?
        Nutzt Permission-Scope-System + Business-Logic
        """
        if self.has_full_access():
            return True
        
        # Importiere neue PermissionService-Klasse mit Scope-Funktionalität
        from .permission_service import PermissionService as ScopePermissionService
        
        perm_service = ScopePermissionService.for_user(self.user)
        
        # Prüfe Permission
        if not perm_service.has_permission('can_view_workorders'):
            return False
        
        # Scope-basierte Prüfung
        scope = perm_service.get_permission_scope('can_view_workorders')
        
        if scope == 'ALL':
            return True
        elif scope == 'DEPARTMENT':
            # Prüfe Abteilung
            user_dept_ids = self.user.department_memberships.filter(
                is_active=True
            ).values_list('department_id', flat=True)
            if workorder.department_id and workorder.department_id in user_dept_ids:
                return True
            # Prüfe FakturaAssignment
            if self._is_assigned_faktur_ma(workorder):
                return True
        elif scope == 'OWN':
            # Ersteller
            if hasattr(workorder, 'created_by') and workorder.created_by == self.user:
                return True
            # Zugewiesener Faktur-MA
            if self._is_assigned_faktur_ma(workorder):
                return True
        
        return False
    
    def can_process_workorder(self, workorder) -> bool:
        """
        Darf User Arbeitsschein bearbeiten (O-/P-Nummern ändern)?
        Nutzt Permission-Scope-System + Business-Logic
        """
        if self.has_full_access():
            return True
        
        # Importiere neue PermissionService-Klasse mit Scope-Funktionalität
        from .permission_service import PermissionService as ScopePermissionService
        
        perm_service = ScopePermissionService.for_user(self.user)
        
        # Prüfe Permission
        if not perm_service.has_permission('can_edit_workorders'):
            return False
        
        # Scope-basierte Prüfung
        scope = perm_service.get_permission_scope('can_edit_workorders')
        
        if scope == 'ALL':
            return True
        elif scope == 'DEPARTMENT':
            # Prüfe Abteilung
            user_dept_ids = self.user.department_memberships.filter(
                is_active=True
            ).values_list('department_id', flat=True)
            if workorder.department_id and workorder.department_id in user_dept_ids:
                return True
            # Prüfe FakturaAssignment
            if self._is_assigned_faktur_ma(workorder):
                return True
        elif scope == 'OWN':
            # Ersteller (sollte normalerweise nicht bearbeiten dürfen, aber mit Permission OK)
            if hasattr(workorder, 'created_by') and workorder.created_by == self.user:
                return True
            # Zugewiesener Faktur-MA (Hauptfall)
            if self._is_assigned_faktur_ma(workorder):
                return True
        
        return False
    
    def can_cancel_workorder(self, workorder) -> bool:
        """
        Darf User Arbeitsschein stornieren?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. Ersteller (created_by)
        3. Faktur-MA
        4. Vertretung des Erstellers
        """
        if self.has_full_access():
            return True
        
        # Ersteller
        if hasattr(workorder, 'created_by') and workorder.created_by == self.user:
            return True
        
        # Faktur-MA
        if self._has_faktur_specialty():
            return True
        
        # Vertretung des Erstellers
        if hasattr(workorder, 'created_by') and workorder.created_by:
            if self.is_substituting_for(workorder.created_by):
                return True
        
        return False
    
    def can_download_workorder(self, workorder) -> bool:
        """
        Darf User Arbeitsschein-PDF herunterladen?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. Faktur-MA (alle)
        3. Zugewiesener Faktur-MA
        4. Vertretung des Faktur-MA
        """
        if self.has_full_access():
            return True
        
        # Faktur-MA
        if self._has_faktur_specialty():
            return True
        
        # Zugewiesener Faktur-MA
        if self._is_assigned_faktur_ma(workorder):
            return True
        
        # Vertretung
        if self._is_substituting_assigned_faktur_ma(workorder):
            return True
        
        return False
    
    def get_visible_workorders_queryset(self, workorder_model):
        """
        Gibt QuerySet der sichtbaren Arbeitsscheine zurück
        
        Filter:
        1. Eigene (created_by)
        2. Zugewiesene (via WorkorderAssignment)
        3. Bereich (als BL)
        4. Alle (als Faktur-MA mit Toggle)
        """
        if self.has_full_access():
            return workorder_model.objects.all()
        
        from workorders.models import WorkorderAssignment
        
        # Eigene
        filters = Q(created_by=self.user)
        
        # Zugewiesene (User ist Faktur-MA)
        assigned_service_managers = WorkorderAssignment.objects.filter(
            faktur_processor=self.user,
            is_active=True
        ).values_list('service_manager', flat=True)
        
        if assigned_service_managers:
            filters |= Q(created_by__in=assigned_service_managers)
        
        # Vertretungen
        substituted_users = self.get_substituted_users()
        if substituted_users:
            # Vertretung für Service Manager
            filters |= Q(created_by__in=substituted_users)
            
            # Vertretung für Faktur-MA
            substituted_assignments = WorkorderAssignment.objects.filter(
                faktur_processor__in=substituted_users,
                is_active=True
            ).values_list('service_manager', flat=True)
            
            if substituted_assignments:
                filters |= Q(created_by__in=substituted_assignments)
        
        # Bereichsleiter: Alle aus ihrem Bereich
        if self._is_bereichsleiter():
            user_departments = self.user.department_memberships.filter(
                is_active=True,
                role__code='BL'
            ).values_list('department', flat=True)
            
            # Service Manager aus diesen Departments
            from auth_user.models import DepartmentMember
            department_members = DepartmentMember.objects.filter(
                department__in=user_departments,
                is_active=True
            ).values_list('user', flat=True)
            
            filters |= Q(created_by__in=department_members)
        
        return workorder_model.objects.filter(filters).distinct()
    
    # ===== PRIVATE HELPER FÜR WORKORDERS =====
    
    def _is_assigned_faktur_ma(self, workorder) -> bool:
        """Prüft ob User zugewiesener Faktur-MA für diesen Workorder ist"""
        if not hasattr(workorder, 'created_by') or not workorder.created_by:
            return False
        
        from auth_user.profile_models import FakturaAssignment
        
        return FakturaAssignment.objects.filter(
            employee=workorder.created_by,
            faktura_processor=self.user,
            is_active=True
        ).exists()
    
    def _is_substituting_assigned_faktur_ma(self, workorder) -> bool:
        """Prüft ob User Vertretung für den zugewiesenen Faktur-MA ist"""
        if not hasattr(workorder, 'created_by') or not workorder.created_by:
            return False
        
        from auth_user.profile_models import FakturaAssignment
        
        # Finde zugewiesene Faktur-MAs
        assigned_faktur_mas = FakturaAssignment.objects.filter(
            employee=workorder.created_by,
            is_active=True
        ).values_list('faktura_processor', flat=True)
        
        # Ist User Vertretung für einen davon?
        for faktur_ma_id in assigned_faktur_mas:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                faktur_ma = User.objects.get(id=faktur_ma_id)
                if self.is_substituting_for(faktur_ma):
                    return True
            except User.DoesNotExist:
                continue
        
        return False
    
    def _is_service_manager_supervisor(self, workorder) -> bool:
        """Prüft ob User Bereichsleiter des Service Managers ist"""
        if not hasattr(workorder, 'created_by') or not workorder.created_by:
            return False
        
        from auth_user.models import DepartmentMember
        
        # Hole Departments des Service Managers
        sm_departments = DepartmentMember.objects.filter(
            user=workorder.created_by,
            is_active=True
        ).values_list('department', flat=True)
        
        # Ist User BL in einem dieser Departments?
        is_bl = DepartmentMember.objects.filter(
            user=self.user,
            department__in=sm_departments,
            role__code='BL',
            is_active=True
        ).exists()
        
        return is_bl
    
    def _has_faktur_specialty(self) -> bool:
        """Prüft ob User Faktur-Specialty hat"""
        cache_key = 'has_faktur_specialty'
        
        if cache_key not in self._cache:
            from auth_user.profile_models import MemberSpecialty
            
            self._cache[cache_key] = MemberSpecialty.objects.filter(
                member__user=self.user,
                member__is_active=True,
                specialty__code='FAKTUR',
                is_active=True
            ).exists()
        
        return self._cache[cache_key]
    
    def _is_bereichsleiter(self) -> bool:
        """Prüft ob User Bereichsleiter ist"""
        cache_key = 'is_bereichsleiter'
        
        if cache_key not in self._cache:
            self._cache[cache_key] = self.user.department_memberships.filter(
                is_active=True,
                role__code='BL'
            ).exists()
        
        return self._cache[cache_key]
    
    def can_reassign_workorder(self, workorder) -> bool:
        """Darf User Arbeitsschein neu zuweisen?"""
        if self.has_full_access():
            return True
        
        # Faktur-MA können Workorders neu zuweisen
        return self._has_faktur_specialty()
    
    # ===== ABWESENHEITS-CHECKS (ERWEITERT) =====
    
    def can_view_absence(self, absence) -> bool:
        """
        Darf User Abwesenheit sehen?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. Eigene Abwesenheit
        3. Vorgesetzter (direct_supervisor oder AL/BL)
        4. HR-Mitarbeiter
        5. Zugewiesener HR-MA (via HRAssignment)
        6. Vertretung
        """
        if self.has_full_access():
            return True
        
        # Eigene Abwesenheit
        if absence.user == self.user:
            return True
        
        # Kann genehmigen (= Vorgesetzter)
        if self.can_approve_absence(absence):
            return True
        
        # HR-Mitarbeiter
        if self._is_hr_member():
            return True
        
        # Zugewiesener HR-MA
        if self._is_assigned_hr_ma(absence):
            return True
        
        # Ist Vertretung
        if hasattr(absence, 'representative') and absence.representative == self.user:
            return True
        
        return False
    
    def can_approve_absence(self, absence) -> bool:
        """
        Darf User Abwesenheit genehmigen?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. Direct Supervisor (UserProfile.direct_supervisor)
        3. AL/BL im gleichen Department
        4. Vertretung des Supervisors
        """
        if self.has_full_access():
            return True
        
        # Ist direkter Vorgesetzter?
        if hasattr(absence.user, 'profile') and absence.user.profile:
            if absence.user.profile.direct_supervisor == self.user:
                return True
        
        # Ist AL/BL im gleichen Department?
        from auth_user.models import DepartmentMember
        
        # Hole Departments des Mitarbeiters
        employee_departments = DepartmentMember.objects.filter(
            user=absence.user,
            is_active=True
        ).values_list('department', flat=True)
        
        # Ist User AL/BL in einem dieser Departments?
        is_department_leader = DepartmentMember.objects.filter(
            user=self.user,
            department__in=employee_departments,
            role__code__in=['AL', 'BL', 'GF', 'GF_OPS'],
            role__hierarchy_level__lte=2,
            is_active=True
        ).exists()
        
        if is_department_leader:
            return True
        
        # Vertretung des Supervisors
        if hasattr(absence.user, 'profile') and absence.user.profile.direct_supervisor:
            supervisor = absence.user.profile.direct_supervisor
            if self.is_substituting_for(supervisor):
                return True
        
        return False
    
    def can_process_absence_as_hr(self, absence) -> bool:
        """
        Darf User Abwesenheit als HR bearbeiten?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. HR-Mitarbeiter (Group 'HR')
        3. Zugewiesener HR-MA (via HRAssignment)
        """
        if self.has_full_access():
            return True
        
        # HR-Mitarbeiter
        if self._is_hr_member():
            return True
        
        # Zugewiesener HR-MA
        if self._is_assigned_hr_ma(absence):
            return True
        
        return False
    
    def get_visible_absences_queryset(self, absence_model):
        """
        Gibt QuerySet der sichtbaren Abwesenheiten zurück
        
        Filter:
        1. Eigene
        2. Als Vorgesetzter (direct_supervisor oder AL/BL)
        3. Als HR
        4. Als zugewiesener HR-MA
        5. Als Vertretung
        """
        if self.has_full_access():
            return absence_model.objects.all()
        
        from auth_user.models import DepartmentMember
        from auth_user.profile_models import HRAssignment
        
        filters = Q(user=self.user)  # Eigene
        
        # Als direkter Supervisor (Legacy)
        if hasattr(self.user, 'direct_reports'):
            supervised_user_ids = self.user.direct_reports.values_list('user_id', flat=True)
            if supervised_user_ids:
                filters |= Q(user__in=supervised_user_ids)
        
        # Als AL/BL: Alle aus Department
        user_leader_departments = DepartmentMember.objects.filter(
            user=self.user,
            role__hierarchy_level__lte=2,
            is_active=True
        ).values_list('department', flat=True)
        
        if user_leader_departments:
            department_members = DepartmentMember.objects.filter(
                department__in=user_leader_departments,
                is_active=True
            ).values_list('user', flat=True)
            
            filters |= Q(user__in=department_members)
        
        # Als HR: Alle
        if self._is_hr_member():
            return absence_model.objects.all()
        
        # Als zugewiesener HR-MA
        assigned_employees = HRAssignment.objects.filter(
            hr_processor=self.user,
            is_active=True
        ).values_list('employee', flat=True)
        
        if assigned_employees:
            filters |= Q(user__in=assigned_employees)
        
        # Als Vertretung
        filters |= Q(representative=self.user)
        
        return absence_model.objects.filter(filters).distinct()
    
    # ===== SOFORTMELDUNG-CHECKS =====
    
    def can_view_sofortmeldung(self, sofortmeldung) -> bool:
        """
        Darf User Sofortmeldung sehen?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. Ersteller (createdBy)
        3. HR-Mitarbeiter
        4. Zugewiesener HR-MA (assigned_hr)
        """
        if self.has_full_access():
            return True
        
        # Ersteller
        if hasattr(sofortmeldung, 'createdBy') and sofortmeldung.createdBy == self.user:
            return True
        
        # HR-Mitarbeiter
        if self._is_hr_member():
            return True
        
        # Zugewiesener HR-MA
        if hasattr(sofortmeldung, 'assigned_hr') and sofortmeldung.assigned_hr == self.user:
            return True
        
        return False
    
    def can_request_sofortmeldung_cancellation(self, sofortmeldung) -> bool:
        """
        Darf User Stornierung anfragen?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. Ersteller (createdBy)
        3. HR-Mitarbeiter
        4. Zugewiesener HR-MA
        """
        # Gleiche Logik wie view
        return self.can_view_sofortmeldung(sofortmeldung)
    
    def can_approve_sofortmeldung_cancellation(self, sofortmeldung) -> bool:
        """
        Darf User Stornierung genehmigen?
        
        Berechtigt sind:
        1. Superuser/Staff/GF
        2. HR-Mitarbeiter
        """
        if self.has_full_access():
            return True
        
        return self._is_hr_member()
    
    # ===== PRIVATE HELPER FÜR ABSENCES/SOFORTMELDUNG =====
    
    def _is_hr_member(self) -> bool:
        """Prüft ob User in HR-Group ist"""
        cache_key = 'is_hr_member'
        
        if cache_key not in self._cache:
            self._cache[cache_key] = self.user.groups.filter(name='HR').exists()
        
        return self._cache[cache_key]
    
    def _is_assigned_hr_ma(self, absence) -> bool:
        """Prüft ob User zugewiesener HR-MA für diese Abwesenheit ist"""
        from auth_user.profile_models import HRAssignment
        
        return HRAssignment.objects.filter(
            employee=absence.user,
            hr_processor=self.user,
            is_active=True
        ).exists()
    
    def get_visible_sofortmeldungen_queryset(self, sofortmeldung_model):
        """
        Gibt QuerySet der sichtbaren Sofortmeldungen zurück
        
        Filter:
        1. Eigene (createdBy)
        2. Als HR: Alle
        3. Als zugewiesener HR-MA
        """
        if self.has_full_access():
            return sofortmeldung_model.objects.all()
        
        filters = Q(createdBy=self.user)  # Eigene
        
        # Als HR: Alle
        if self._is_hr_member():
            return sofortmeldung_model.objects.all()
        
        # Als zugewiesener HR-MA
        filters |= Q(assigned_hr=self.user)
        
        return sofortmeldung_model.objects.filter(filters).distinct()
    
    # ===== HELPER =====
    
    @classmethod
    def for_user(cls, user):
        """Factory Method"""
        return cls(user)
    
    def clear_cache(self):
        """Cache leeren (z.B. nach Änderungen)"""
        self._cache = {}
