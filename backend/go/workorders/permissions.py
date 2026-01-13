"""
Custom Permission Classes für WorkOrders

Verwendet:
- Django Guardian für objektbasierte Permissions
- PermissionService für Business Logic
- WorkorderAssignment für Zuweisungen
"""
from rest_framework import permissions
from django.utils import timezone
from django.db.models import Q


class CanCancelWorkorder(permissions.BasePermission):
    """
    Permission zum Stornieren von Arbeitsscheinen
    
    Berechtigt sind:
    1. Ersteller (created_by)
    2. Faktur-Mitarbeiter mit Specialty "Fakturierung"
    3. Vertretung des Erstellers bei Abwesenheit
    4. Admins/Superuser
    """
    
    def has_permission(self, request, view):
        """Liste aller Workorders die User stornieren darf"""
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Prüft ob User diesen spezifischen Workorder stornieren darf"""
        user = request.user
        workorder = obj
        
        # 1. Bypass: Superuser/Staff
        if user.is_superuser or user.is_staff:
            return True
        
        # 2. Ersteller
        if workorder.created_by == user:
            return True
        
        # 3. Faktur-MA mit Specialty "Fakturierung"
        from auth_user.profile_models import MemberSpecialty
        
        # Prüfe ob User Faktur-Specialty hat
        has_faktur_specialty = MemberSpecialty.objects.filter(
            member__user=user,
            member__is_active=True,
            specialty__code='FAKTUR',  # Code für Fakturierung
            is_active=True
        ).exists()
        
        if has_faktur_specialty:
            return True
        
        # 4. Vertretung des Erstellers bei Abwesenheit
        if workorder.created_by:
            from absences.models import Absence
            from auth_user.profile_models import SubstituteAssignment
            
            today = timezone.now().date()
            
            # Check: Direkte Vertretung via Absence.representative
            is_representative = Absence.objects.filter(
                user=workorder.created_by,
                representative=user,
                start_date__lte=today,
                end_date__gte=today,
                status__in=['approved', 'hr_processed']
            ).exists()
            
            if is_representative:
                return True
            
            # Check: SubstituteAssignment
            is_substitute = SubstituteAssignment.objects.filter(
                original_user=workorder.created_by,
                substitute_user=user,
                is_active=True,
                absence__start_date__lte=today,
                absence__end_date__gte=today,
                absence__status__in=['approved', 'hr_processed']
            ).exists()
            
            if is_substitute:
                return True
        
        return False


class CanViewAllWorkorders(permissions.BasePermission):
    """
    Permission für "Alle Arbeitsscheine anzeigen" Toggle
    
    Berechtigt sind:
    1. Faktur-Mitarbeiter mit Specialty "Fakturierung"
    2. Bereichsleiter (BL)
    3. Abteilungsleiter (AL)
    4. Admins/Superuser
    
    Verwendet Custom Permission: 'workorders.view_all_workorders'
    """
    
    def has_permission(self, request, view):
        user = request.user
        
        # 1. Bypass: Superuser/Staff
        if user.is_superuser or user.is_staff:
            return True
        
        # 2. Faktur-MA
        from auth_user.profile_models import MemberSpecialty
        
        has_faktur_specialty = MemberSpecialty.objects.filter(
            member__user=user,
            member__is_active=True,
            specialty__code='FAKTUR',
            is_active=True
        ).exists()
        
        if has_faktur_specialty:
            return True
        
        # 3. AL/BL (hierarchy_level <= 2)
        from auth_user.models import DepartmentMember
        
        is_leader = DepartmentMember.objects.filter(
            user=user,
            role__hierarchy_level__lte=2,  # AL=2, BL=2, GF=1
            is_active=True
        ).exists()
        
        if is_leader:
            return True
        
        # 4. Django Permission Check
        return user.has_perm('workorders.view_all_workorders')


class CanManageWorkorderAssignments(permissions.BasePermission):
    """
    Permission zum Verwalten von WorkorderAssignments
    
    Berechtigt sind:
    1. Faktur-Abteilung (Department mit Specialty "Fakturierung")
    2. Admins/Superuser
    """
    
    def has_permission(self, request, view):
        user = request.user
        
        # 1. Bypass: Superuser/Staff
        if user.is_superuser or user.is_staff:
            return True
        
        # 2. Faktur-Abteilung
        from auth_user.models import DepartmentMember
        from auth_user.profile_models import Specialty
        
        # Finde Faktur-Department
        try:
            faktur_specialty = Specialty.objects.get(code='FAKTUR')
            faktur_department = faktur_specialty.department
            
            # Ist User Mitglied in Faktur-Department?
            is_faktur_member = DepartmentMember.objects.filter(
                user=user,
                department=faktur_department,
                is_active=True
            ).exists()
            
            return is_faktur_member
        except Specialty.DoesNotExist:
            return False


class IsWorkorderAssignee(permissions.BasePermission):
    """
    Permission: User ist zugewiesener Faktur-MA für diesen Workorder
    
    Verwendet WorkorderAssignment Model
    """
    
    def has_permission(self, request, view):
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        workorder = obj
        
        # 1. Bypass: Superuser/Staff
        if user.is_superuser or user.is_staff:
            return True
        
        # 2. Direkter Assignee
        from workorders.models import WorkorderAssignment
        
        # Finde aktive Zuweisung für diesen Service Manager
        if not workorder.created_by:
            return False
        
        assignment = WorkorderAssignment.objects.filter(
            employee=workorder.created_by,
            faktura_processor=user,
            is_active=True
        ).first()
        
        if assignment:
            # Optional: Department-Filter
            if assignment.department:
                # Prüfe ob Workorder zu diesem Department gehört
                # (Workorder hat kein direct department field, nutze created_by)
                from auth_user.models import DepartmentMember
                
                service_manager_in_dept = DepartmentMember.objects.filter(
                    user=workorder.created_by,
                    department=assignment.department,
                    is_active=True
                ).exists()
                
                return service_manager_in_dept
            
            return True
        
        # 3. Vertretung des Assignee
        from auth_user.profile_models import SubstituteAssignment
        
        today = timezone.now().date()
        
        # Finde alle Faktur-MAs die diesem Service Manager zugewiesen sind
        assignments = WorkorderAssignment.objects.filter(
            employee=workorder.created_by,
            is_active=True
        ).values_list('faktura_processor', flat=True)
        
        # Ist User Vertretung für einen dieser Faktur-MAs?
        is_substitute = SubstituteAssignment.objects.filter(
            original_user__in=assignments,
            substitute_user=user,
            is_active=True,
            absence__start_date__lte=today,
            absence__end_date__gte=today,
            absence__status__in=['approved', 'hr_processed']
        ).exists()
        
        return is_substitute


class IsServiceManagerOrAssignee(permissions.BasePermission):
    """
    Permission: User ist entweder Service Manager (Ersteller) oder zugewiesener Faktur-MA
    
    Für Chat-Nachrichten zwischen SM und Faktur-MA
    """
    
    def has_permission(self, request, view):
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        workorder = obj
        
        # 1. Bypass: Superuser/Staff
        if user.is_superuser or user.is_staff:
            return True
        
        # 2. Service Manager (Ersteller)
        if workorder.created_by == user:
            return True
        
        # 3. Zugewiesener Faktur-MA
        assignee_permission = IsWorkorderAssignee()
        return assignee_permission.has_object_permission(request, view, obj)


class CanDownloadWorkorder(permissions.BasePermission):
    """
    Permission zum PDF-Download von Arbeitsscheinen
    
    Berechtigt sind:
    1. Faktur-Mitarbeiter
    2. Zugewiesener Faktur-MA
    3. Admins/Superuser
    """
    
    def has_permission(self, request, view):
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        
        # 1. Bypass: Superuser/Staff
        if user.is_superuser or user.is_staff:
            return True
        
        # 2. Faktur-MA
        from auth_user.profile_models import MemberSpecialty
        
        has_faktur_specialty = MemberSpecialty.objects.filter(
            member__user=user,
            member__is_active=True,
            specialty__code='FAKTUR',
            is_active=True
        ).exists()
        
        if has_faktur_specialty:
            return True
        
        # 3. Zugewiesener Faktur-MA
        assignee_permission = IsWorkorderAssignee()
        return assignee_permission.has_object_permission(request, view, obj)
