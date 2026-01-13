"""
ViewSets für Specialty-Related Models
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q, Prefetch
from .profile_models import (
    Specialty, MemberSpecialty, WorkorderAssignment, SubstituteAssignment,
    DepartmentMember
)
from .specialty_serializers import (
    SpecialtySerializer, MemberSpecialtySerializer,
    WorkorderAssignmentSerializer, SubstituteAssignmentSerializer
)
from .permissions import PermissionService
from .decorators import require_full_access


class SpecialtyViewSet(viewsets.ModelViewSet):
    """ViewSet für Fachbereiche"""
    queryset = Specialty.objects.select_related('department', 'parent').filter(is_active=True)
    serializer_class = SpecialtySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Disable pagination
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter nach Department
        department = self.request.query_params.get('department')
        if department:
            qs = qs.filter(department_id=department)
        
        # Filter nach Code
        code = self.request.query_params.get('code')
        if code:
            qs = qs.filter(code__iexact=code)
        
        # Suche
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(search_keywords__icontains=search)
            )
        
        return qs.order_by('department__name', 'display_order', 'name')
    
    @action(detail=False, methods=['get'])
    def by_department(self, request):
        """Gibt Fachbereiche gruppiert nach Department zurück"""
        department_id = request.query_params.get('department_id')
        
        if not department_id:
            return Response({'error': 'department_id required'}, status=400)
        
        specialties = self.get_queryset().filter(department_id=department_id)
        serializer = self.get_serializer(specialties, many=True)
        
        return Response(serializer.data)


class MemberSpecialtyViewSet(viewsets.ModelViewSet):
    """ViewSet für Fachbereichs-Zuordnungen"""
    queryset = MemberSpecialty.objects.select_related(
        'member__user', 'member__department', 'member__role', 'specialty'
    )  # Entferne .filter(is_active=True) um ALLE zu laden
    serializer_class = MemberSpecialtySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Disable pagination für direkten Array-Response
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # DEBUG: Log the initial queryset
        print(f"🔍 Initial queryset count: {qs.count()}")
        
        # Filter nach Member
        member = self.request.query_params.get('member')
        if member:
            print(f"🔍 Filtering by member_id={member}")
            qs = qs.filter(member_id=member)
            print(f"🔍 After member filter: {qs.count()} results")
            print(f"🔍 Query: {qs.query}")
        
        # Filter nach User
        user = self.request.query_params.get('user')
        if user:
            print(f"🔍 Filtering by user_id={user}")
            qs = qs.filter(member__user_id=user)
            print(f"🔍 After user filter: {qs.count()} results")
        
        # Filter nach Specialty
        specialty = self.request.query_params.get('specialty')
        if specialty:
            qs = qs.filter(specialty_id=specialty)
        
        # Filter nach Department
        department = self.request.query_params.get('department')
        if department:
            qs = qs.filter(member__department_id=department)
        
        # Optional: Filter nach is_active (standardmäßig alle)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1', 'yes'])
        
        print(f"✅ Final queryset count: {qs.count()}")
        return qs.order_by('-is_primary', 'specialty__display_order')
    
    @action(detail=False, methods=['get'])
    def my_specialties(self, request):
        """Gibt Fachbereiche des aktuellen Users zurück"""
        specialties = self.get_queryset().filter(member__user=request.user)
        serializer = self.get_serializer(specialties, many=True)
        return Response(serializer.data)


class WorkorderAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet für Arbeitsschein-Zuordnungen"""
    queryset = WorkorderAssignment.objects.select_related(
        'submitter', 'processor', 'specialty'
    ).filter(is_active=True)
    serializer_class = WorkorderAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        perms = PermissionService.for_user(self.request.user)
        
        # Admins sehen alles
        if perms.has_full_access():
            return qs
        
        # Normale User sehen nur ihre eigenen Zuordnungen
        return qs.filter(
            Q(submitter=self.request.user) | Q(processor=self.request.user)
        )
    
    def perform_create(self, serializer):
        """
        Automatically set processor to current user when creating
        Similar to HRAssignment pattern
        """
        serializer.save(processor=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my(self, request):
        """
        Get workorder assignments where current user is the processor
        GET /api/workorder-assignments/my/
        """
        assignments = WorkorderAssignment.objects.filter(
            processor=request.user,
            is_active=True
        ).select_related('submitter', 'processor', 'specialty')
        
        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_assignments(self, request):
        """Gibt Zuordnungen des aktuellen Users zurück (Legacy)"""
        as_submitter = self.get_queryset().filter(submitter=request.user)
        as_processor = self.get_queryset().filter(processor=request.user)
        
        return Response({
            'as_submitter': self.get_serializer(as_submitter, many=True).data,
            'as_processor': self.get_serializer(as_processor, many=True).data
        })
    
    @action(detail=False, methods=['post'])
    def auto_assign(self, request):
        """
        Automatische Zuordnung eines Users zu einem Faktur-Mitarbeiter
        Body: {"submitter_id": 123, "specialty_code": "FIN-FAK"}
        """
        perms = PermissionService.for_user(request.user)
        
        if not perms.has_full_access():
            raise PermissionDenied("Nur Admins können automatische Zuordnungen erstellen")
        
        submitter_id = request.data.get('submitter_id')
        specialty_code = request.data.get('specialty_code')
        
        if not submitter_id or not specialty_code:
            return Response({'error': 'submitter_id and specialty_code required'}, status=400)
        
        try:
            specialty = Specialty.objects.get(code=specialty_code, is_active=True)
        except Specialty.DoesNotExist:
            return Response({'error': f'Specialty {specialty_code} not found'}, status=404)
        
        # Finde Processor mit diesem Fachbereich
        processors = DepartmentMember.objects.filter(
            specialty_assignments__specialty=specialty,
            specialty_assignments__is_active=True,
            is_active=True
        ).select_related('user').distinct()
        
        if not processors.exists():
            return Response({'error': f'Kein Processor für {specialty_code} gefunden'}, status=404)
        
        # Nimm ersten verfügbaren Processor (könnte später mit Workload-Balancing erweitert werden)
        processor = processors.first().user
        
        # Erstelle oder aktualisiere Assignment
        assignment, created = WorkorderAssignment.objects.update_or_create(
            submitter_id=submitter_id,
            specialty=specialty,
            defaults={
                'processor': processor,
                'is_auto_assigned': True,
                'is_active': True
            }
        )
        
        serializer = self.get_serializer(assignment)
        return Response({
            'created': created,
            'assignment': serializer.data
        })


class SubstituteAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet für Vertretungs-Zuordnungen"""
    queryset = SubstituteAssignment.objects.select_related(
        'original_user', 'substitute_user', 'absence'
    ).prefetch_related('specialties').filter(is_active=True)
    serializer_class = SubstituteAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        perms = PermissionService.for_user(self.request.user)
        
        # Admins sehen alles
        if perms.has_full_access():
            return qs
        
        # Normale User sehen nur ihre eigenen Vertretungen
        return qs.filter(
            Q(original_user=self.request.user) | Q(substitute_user=self.request.user)
        )
    
    @action(detail=False, methods=['get'])
    def my_substitutions(self, request):
        """Gibt aktuelle Vertretungen des Users zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        
        # Wo User andere vertritt
        substituting = self.get_queryset().filter(
            substitute_user=request.user,
            absence__start_date__lte=today,
            absence__end_date__gte=today
        )
        
        # Wer User vertritt
        substituted_by = self.get_queryset().filter(
            original_user=request.user,
            absence__start_date__lte=today,
            absence__end_date__gte=today
        )
        
        return Response({
            'i_substitute': self.get_serializer(substituting, many=True).data,
            'substituted_by': self.get_serializer(substituted_by, many=True).data
        })
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Gibt alle aktuell aktiven Vertretungen zurück"""
        from django.utils import timezone
        from absences.models import Absence
        
        today = timezone.now().date()
        
        active = self.get_queryset().filter(
            absence__start_date__lte=today,
            absence__end_date__gte=today,
            absence__status__in=[Absence.APPROVED, Absence.HR_PROCESSED]
        )
        
        serializer = self.get_serializer(active, many=True)
        return Response(serializer.data)
