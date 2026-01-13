from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ContactProfile
from .serializers import ContactProfileSerializer, ContactDirectorySerializer


class ContactProfileViewSet(viewsets.ModelViewSet):
    """
    API ViewSet für Contact Profiles
    
    Endpoints:
    - GET /api/contacts/ - Liste aller sichtbaren Kontakte
    - GET /api/contacts/{id}/ - Einzelner Kontakt
    - GET /api/contacts/directory/ - Vereinfachtes Mitarbeiterverzeichnis
    - GET /api/contacts/my_profile/ - Eigenes Profil
    """
    
    queryset = ContactProfile.objects.select_related('user').filter(
        is_visible_in_directory=True,
        user__is_active=True
    )
    serializer_class = ContactProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    filterset_fields = {
        'office_location': ['exact', 'icontains'],
        'preferred_contact_method': ['exact'],
        'is_visible_in_directory': ['exact'],
    }
    
    search_fields = [
        'user__first_name', 'user__last_name', 'user__username',
        'user__email', 'user__job_title',
        'office_location', 'desk_number'
    ]
    
    ordering_fields = [
        'user__last_name', 'user__first_name', 
        'office_location'
    ]
    ordering = ['user__last_name', 'user__first_name']
    
    def get_queryset(self):
        """
        Admins und HR sehen alle Profile,
        normale User nur sichtbare Profile
        """
        user = self.request.user
        queryset = ContactProfile.objects.select_related('user')
        
        # Admins/HR sehen alles
        if user.is_staff or user.is_superuser:
            return queryset
        
        # Normale User sehen nur aktive & sichtbare Profile
        return queryset.filter(
            is_visible_in_directory=True,
            user__is_active=True
        )
    
    @action(detail=False, methods=['get'])
    def directory(self, request):
        """
        Vereinfachtes Mitarbeiterverzeichnis
        Nur öffentliche Informationen
        """
        queryset = self.filter_queryset(self.get_queryset())
        serializer = ContactDirectorySerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def my_profile(self, request):
        """
        Eigenes Kontaktprofil abrufen/aktualisieren
        """
        profile, created = ContactProfile.objects.get_or_create(
            user=request.user
        )
        
        if request.method == 'GET':
            serializer = ContactProfileSerializer(profile)
            return Response(serializer.data)
        
        elif request.method in ['PUT', 'PATCH']:
            # User darf nur eigene nicht-sensible Felder ändern
            allowed_fields = [
                'work_extension', 'preferred_contact_method',
                'teams_id', 'slack_id', 'typical_work_hours',
                'office_location', 'desk_number'
            ]
            
            # Filtere nur erlaubte Felder
            data = {k: v for k, v in request.data.items() if k in allowed_fields}
            
            partial = request.method == 'PATCH'
            serializer = ContactProfileSerializer(
                profile, data=data, partial=partial
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_department(self, request):
        """
        Gruppiert Kontakte nach Abteilungen
        """
        from collections import defaultdict
        
        queryset = self.filter_queryset(self.get_queryset())
        departments = defaultdict(list)
        
        for profile in queryset:
            if hasattr(profile.user, 'profile') and profile.user.profile.department:
                dept = profile.user.profile.department.name
            else:
                dept = 'Nicht zugewiesen'
            departments[dept].append(
                ContactDirectorySerializer(profile).data
            )
        
        return Response(dict(departments))
