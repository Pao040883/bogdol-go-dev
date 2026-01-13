"""
API Views/ViewSets für Profile, Chat, Presence etc.
"""
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .profile_models import (
    Company, Department, Team, UserProfile, UserPresence,
    DepartmentRole, DepartmentMember
)
from .chat_models import ChatConversation, ChatMessage, ChatTypingIndicator
from .profile_serializers import (
    CompanySerializer, DepartmentSerializer, TeamSerializer,
    DepartmentRoleSerializer, DepartmentMemberSerializer,
    UserProfileDetailSerializer, UserProfileListSerializer,
    UserPresenceSerializer,
    ChatConversationListSerializer, ChatConversationDetailSerializer,
    ChatMessageSerializer, ChatParticipantSerializer
)
from .embedding_service import search_profiles_semantic

User = get_user_model()


# ============================================================================
# PERMISSIONS
# ============================================================================

class IsAuthenticatedOrReadOnly(permissions.BasePermission):
    """Nur authentifizierte User dürfen schreiben"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Nur der Owner darf sein Profil/Chat bearbeiten"""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Für Profile
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        # Für Chat
        if hasattr(obj, 'participants'):
            return request.user in obj.participants.all()
        
        return False


# ============================================================================
# PAGINATION
# ============================================================================

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ChatMessagePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


# ============================================================================
# COMPANY & DEPARTMENT VIEWSETS
# ============================================================================

class CompanyViewSet(viewsets.ModelViewSet):
    """
    API für Gesellschaften
    
    GET /api/companies/ - Liste aller Gesellschaften
    GET /api/companies/{id}/ - Detail
    POST /api/companies/ - Neue Gesellschaft (nur Staff)
    PUT /api/companies/{id}/ - Ändern
    DELETE /api/companies/{id}/ - Löschen (nur Staff)
    """
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'code', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter nur aktive, wenn nicht explizit gewünscht
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        
        return queryset


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    API für Abteilungen
    
    GET /api/departments/ - Liste aller Abteilungen
    GET /api/departments/{id}/ - Detail
    POST /api/departments/ - Neue Abteilung (nur Staff)
    PUT /api/departments/{id}/ - Ändern
    DELETE /api/departments/{id}/ - Löschen (nur Staff)
    GET /api/departments/{id}/members/ - Member der Abteilung
    GET /api/departments/tree/ - Baum-Ansicht aller Abteilungen
    GET /api/departments/orgchart/ - Organigramm-Daten mit Hierarchie
    """
    queryset = Department.objects.select_related('parent').prefetch_related('memberships__user', 'memberships__role')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = None  # Disable pagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'code', 'org_type']
    ordering = ['name']
    
    def get_permissions(self):
        """Nur Staff darf ändern"""
        if self.request.method not in permissions.SAFE_METHODS:
            return [permissions.IsAdminUser()]
        return super().get_permissions()
    
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Alle Member der Abteilung mit Rollen"""
        department = self.get_object()
        memberships = department.memberships.filter(is_active=True).select_related(
            'user', 'role', 'reports_to'
        )
        serializer = DepartmentMemberSerializer(memberships, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def orgchart(self, request):
        """
        Organigramm-Daten: Hierarchische Struktur mit Members
        """
        org_type = request.query_params.get('org_type', None)
        
        queryset = Department.objects.filter(is_active=True)
        if org_type:
            queryset = queryset.filter(org_type=org_type)
        
        root_departments = queryset.filter(parent__isnull=True)
        
        def build_org_node(department):
            """Baut Organigramm-Node mit Members"""
            # Members der Abteilung
            memberships = department.memberships.filter(is_active=True).select_related(
                'user', 'role', 'reports_to'
            ).order_by('role__hierarchy_level', 'display_order')
            
            members_data = []
            for membership in memberships:
                member_node = {
                    'id': membership.id,
                    'user_id': membership.user.id,
                    'full_name': membership.user.get_full_name(),
                    'email': membership.user.email,
                    'avatar': membership.user.profile.avatar.url if hasattr(membership.user, 'profile') and membership.user.profile.avatar else None,
                    'role': {
                        'id': membership.role.id,
                        'name': membership.role.name,
                        'code': membership.role.code,
                        'hierarchy_level': membership.role.hierarchy_level,
                        'color': membership.role.color
                    },
                    'position_title': membership.position_title,
                    'reports_to_id': membership.reports_to_id,
                    'is_primary': membership.is_primary
                }
                members_data.append(member_node)
            
            # Sub-Departments
            children = Department.objects.filter(parent=department, is_active=True)
            children_data = [build_org_node(child) for child in children]
            
            return {
                'id': department.id,
                'name': department.name,
                'code': department.code,
                'org_type': department.org_type,
                'org_type_display': department.get_org_type_display(),
                'members': members_data,
                'children': children_data
            }
        
        result = [build_org_node(dept) for dept in root_departments]
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Hierarchischer Baum aller Abteilungen"""
        root_departments = Department.objects.filter(parent__isnull=True)
        serializer = self.get_serializer(root_departments, many=True)
        
        def add_children(dept_data, dept):
            children = Department.objects.filter(parent=dept)
            dept_data['children'] = self.get_serializer(children, many=True).data
            for child_data in dept_data.get('children', []):
                child = next(c for c in children if c.id == child_data['id'])
                add_children(child_data, child)
            return dept_data
        
        result = [add_children(dept_data, dept) 
                 for dept, dept_data in zip(root_departments, serializer.data)]
        
        return Response(result)


class DepartmentRoleViewSet(viewsets.ModelViewSet):
    """
    API für Organisationsrollen
    
    GET /api/org-roles/ - Liste aller Rollen
    GET /api/org-roles/{id}/ - Detail
    POST /api/org-roles/ - Neue Rolle (nur Staff)
    PUT /api/org-roles/{id}/ - Ändern (nur Staff)
    DELETE /api/org-roles/{id}/ - Löschen (nur Staff)
    """
    queryset = DepartmentRole.objects.all()
    serializer_class = DepartmentRoleSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code']
    ordering_fields = ['hierarchy_level', 'name']
    ordering = ['hierarchy_level', 'name']
    
    def get_queryset(self):
        """Filter nach org_type wenn angegeben"""
        queryset = super().get_queryset()
        org_type = self.request.query_params.get('org_type', None)
        if org_type:
            queryset = queryset.filter(Q(org_type=org_type) | Q(org_type='both'))
        return queryset
    
    def get_permissions(self):
        """Nur Staff darf ändern"""
        if self.request.method not in permissions.SAFE_METHODS:
            return [permissions.IsAdminUser()]
        return super().get_permissions()


class DepartmentMemberViewSet(viewsets.ModelViewSet):
    """
    API für Abteilungsmitglieder / Organigramm-Zuordnungen
    
    GET /api/org-members/ - Liste
    GET /api/org-members/{id}/ - Detail
    POST /api/org-members/ - Neue Zuordnung (nur Staff)
    PUT /api/org-members/{id}/ - Ändern (nur Staff)
    DELETE /api/org-members/{id}/ - Löschen (nur Staff)
    GET /api/org-members/by-user/{user_id}/ - Alle Zuordnungen eines Users
    """
    queryset = DepartmentMember.objects.select_related(
        'user', 'department', 'role', 'reports_to'
    ).all()
    serializer_class = DepartmentMemberSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 
                    'department__name', 'position_title']
    ordering_fields = ['department', 'role__hierarchy_level', 'display_order']
    ordering = ['department', 'role__hierarchy_level', 'display_order']
    
    def get_queryset(self):
        """
        Filter nach department, user, is_active
        Zeigt ALLE Memberships an, auch wenn die Company-Zuordnung nicht mehr passt.
        Die Frontend-Anzeige kann dann "inaktive" Zuordnungen kennzeichnen.
        """
        queryset = super().get_queryset()
        
        department_id = self.request.query_params.get('department', None)
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        
        user_id = self.request.query_params.get('user', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    def get_permissions(self):
        """Nur Staff darf ändern"""
        if self.request.method not in permissions.SAFE_METHODS:
            return [permissions.IsAdminUser()]
        return super().get_permissions()
    
    @action(detail=False, methods=['get'], url_path='by-user/(?P<user_id>[^/.]+)')
    def by_user(self, request, user_id=None):
        """Alle Zuordnungen eines Users"""
        memberships = self.get_queryset().filter(user_id=user_id, is_active=True)
        serializer = self.get_serializer(memberships, many=True)
        return Response(serializer.data)


class TeamViewSet(viewsets.ModelViewSet):
    """
    API für Teams
    
    GET /api/teams/ - Liste aller Teams
    GET /api/teams/{id}/ - Detail
    POST /api/teams/ - Neues Team (nur Staff)
    PUT /api/teams/{id}/ - Ändern
    GET /api/teams/{id}/members/ - Team-Members
    """
    queryset = Team.objects.select_related('department', 'lead').prefetch_related('members')
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'department']
    ordering = ['name']
    
    def get_permissions(self):
        """Nur Staff darf ändern"""
        if self.request.method not in permissions.SAFE_METHODS:
            return [permissions.IsAdminUser()]
        return super().get_permissions()
    
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Team-Members anzeigen"""
        team = self.get_object()
        serializer = ChatParticipantSerializer(
            team.members.all(),
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)


# ============================================================================
# USER PROFILE VIEWSETS
# ============================================================================

class UserProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API für User-Profile (Suche/Anzeige)
    
    GET /api/profiles/ - Alle sichtbaren Profile
    GET /api/profiles/{id}/ - Profil-Detail
    GET /api/profiles/me/ - Eigenes Profil
    GET /api/profiles/search/ - Erweiterte Suche
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__username', 'user__email', 'user__first_name', 'user__last_name',
                    'job_title', 'responsibilities', 'expertise_areas', 'office_location']
    ordering_fields = ['user__first_name', 'user__last_name', 'job_title']
    ordering = ['user__first_name']
    
    def get_queryset(self):
        """Nur sichtbare Profile"""
        return UserProfile.objects.filter(
            is_searchable=True,
            user__is_active=True
        ).select_related('user', 'direct_supervisor')
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserProfileDetailSerializer
        return UserProfileListSerializer
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Eigenes Profil anzeigen"""
        profile = request.user.profile
        serializer = UserProfileDetailSerializer(
            profile,
            context={'request': request}
        )
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Erweiterte Suche nach Profil-Feldern
        Query-Parameter:
        - q: Freitext-Suche
        - department: Abteilungs-ID
        - job_title: Job-Titel
        - expertise: Expertise-Suche
        - location: Büro-Standort
        - semantic: Semantische Suche aktivieren
        """
        # Semantic Search aktiviert?
        use_semantic = request.query_params.get('semantic', '').lower() == 'true'
        query = request.query_params.get('q', '')
        
        if use_semantic and query:
            # Semantische Suche mit Relevanz-Scores + Tracking
            results = search_profiles_semantic(
                query, 
                top_k=20,
                user=request.user if request.user.is_authenticated else None,
                track_query=True
            )
            if results:
                # Erweiterte Response mit Scores
                response_data = []
                for item in results:
                    profile = item['profile']
                    serializer = self.get_serializer(profile)
                    data = serializer.data
                    data['relevance_score'] = item['score']
                    data['matched_fields'] = item['matched_fields']
                    response_data.append(data)
                
                return Response(response_data)
            else:
                return Response([])
        
        # Normale Suche
        queryset = self.get_queryset()
        
        # Freitext-Suche
        if query:
            queryset = queryset.filter(
                Q(user__username__icontains=query) |
                Q(user__email__icontains=query) |
                Q(user__first_name__icontains=query) |
                Q(user__last_name__icontains=query) |
                Q(job_title__icontains=query) |
                Q(responsibilities__icontains=query) |
                Q(expertise_areas__icontains=query)
            )
        
        # Filter nach Abteilung
        department = request.query_params.get('department')
        if department:
            # Department is accessed via DepartmentMember relationship
            queryset = queryset.filter(
                user__department_memberships__department_id=department,
                user__department_memberships__is_active=True
            )
        
        # Filter nach Job-Title
        job_title = request.query_params.get('job_title')
        if job_title:
            queryset = queryset.filter(job_title__icontains=job_title)
        
        # Filter nach Expertise
        expertise = request.query_params.get('expertise')
        if expertise:
            queryset = queryset.filter(expertise_areas__icontains=expertise)
        
        # Filter nach Standort
        location = request.query_params.get('location')
        if location:
            queryset = queryset.filter(office_location__icontains=location)
        
        # Pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def upload_public_key(self, request):
        """
        Upload user's public RSA key for E2E encryption
        POST /api/profiles/upload_public_key/
        Body: { "public_key": "base64_encoded_key" }
        """
        from django.utils import timezone
        
        public_key = request.data.get('public_key')
        if not public_key:
            return Response(
                {'error': 'public_key is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profile = request.user.profile
        profile.public_key = public_key
        profile.public_key_updated_at = timezone.now()
        profile.save(update_fields=['public_key', 'public_key_updated_at'])
        
        return Response({
            'status': 'success',
            'message': 'Public key uploaded successfully',
            'updated_at': profile.public_key_updated_at.isoformat()
        })
    
    @action(detail=False, methods=['get'])
    def get_public_keys(self, request):
        """
        Get public keys for multiple users
        GET /api/profiles/get_public_keys/?user_ids=1,2,3
        """
        user_ids_str = request.query_params.get('user_ids', '')
        if not user_ids_str:
            return Response(
                {'error': 'user_ids parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user_ids = [int(uid.strip()) for uid in user_ids_str.split(',') if uid.strip()]
        except ValueError:
            return Response(
                {'error': 'Invalid user_ids format'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profiles = UserProfile.objects.filter(
            user_id__in=user_ids
        ).select_related('user')
        
        keys = {}
        for profile in profiles:
            if profile.public_key:
                keys[str(profile.user.id)] = {
                    'user_id': profile.user.id,
                    'username': profile.user.username,
                    'public_key': profile.public_key,
                    'updated_at': profile.public_key_updated_at.isoformat() if profile.public_key_updated_at else None
                }
        
        return Response(keys)
    
    @action(detail=False, methods=['get'], url_path='service-managers')
    def service_managers(self, request):
        """
        Get all users with Service Manager role (Role code='SM')
        GET /api/profiles/service-managers/
        """
        from .profile_models import DepartmentMember, MemberSpecialty
        
        # Find all users with Role code='SM' (Service Manager)
        service_managers = User.objects.filter(
            department_memberships__role__code='SM',
            is_active=True
        ).distinct().select_related('profile').prefetch_related(
            'department_memberships__department',
            'specialty_memberships__specialty'
        )
        
        data = []
        for user in service_managers:
            # Get primary department if available
            primary_membership = user.department_memberships.filter(is_primary=True).first()
            department = None
            if primary_membership:
                department = {
                    'id': primary_membership.department.id,
                    'name': primary_membership.department.name,
                    'code': primary_membership.department.code
                }
            
            # Get primary specialty if available
            primary_specialty = user.specialty_memberships.filter(is_primary=True).first()
            specialty = None
            if primary_specialty:
                specialty = {
                    'id': primary_specialty.specialty.id,
                    'name': primary_specialty.specialty.name,
                    'code': primary_specialty.specialty.code
                }
            
            data.append({
                'id': user.id,
                'username': user.username,
                'name': f"{user.first_name} {user.last_name}",
                'email': user.email,
                'department': department,
                'specialty': specialty
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def badges(self, request):
        """
        Badge-Counts für aktuellen User abrufen
        GET /api/profiles/badges/
        
        Returns:
            {
                'chat': 5,
                'arbeitsscheine': 2,
                'organigramm': 1,
                'sofortmeldungen': 0,
                'absences': 3,
                'users': 0
            }
        """
        from .badge_helpers import get_user_badge_counts
        
        badges = get_user_badge_counts(request.user)
        return Response(badges)



class UserPresenceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API für Online-Status
    
    GET /api/presence/ - Online-Status aller WIRKLICH aktiven User (mit WebSocket)
    GET /api/presence/{user_id}/ - Status eines spezifischen Users
    """
    serializer_class = UserPresenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    
    def get_queryset(self):
        """Nur User die wirklich online sind (status='online' UND WebSocket aktiv)"""
        return UserPresence.objects.filter(
            status='online',
            websocket_channel_name__isnull=False
        ).exclude(
            websocket_channel_name=''
        ).select_related('user')


# ============================================================================
# CHAT VIEWSETS
# ============================================================================

class ChatConversationViewSet(viewsets.ModelViewSet):
    """
    API für Chat-Konversationen
    
    GET /api/chats/ - Alle eigenen Chats
    GET /api/chats/{id}/ - Chat-Detail mit Nachrichten
    POST /api/chats/ - Neuen Chat starten
    PUT /api/chats/{id}/ - Chat-Einstellungen ändern
    DELETE /api/chats/{id}/ - Chat archivieren
    GET /api/chats/{id}/messages/ - Alle Nachrichten
    POST /api/chats/{id}/mark-as-read/ - Als gelesen markieren
    """
    serializer_class = ChatConversationListSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ['-last_message_at']
    ordering = ['-last_message_at']
    
    def get_queryset(self):
        """Nur eigene Chats, die nicht versteckt sind"""
        from .chat_models import ChatConversationHidden
        
        # Hole alle versteckten Konversations-IDs für diesen User
        hidden_ids = ChatConversationHidden.objects.filter(
            user=self.request.user
        ).values_list('conversation_id', flat=True)
        
        # WICHTIG: Jedes Mal frisch laden, kein QuerySet-Caching
        # Prefetch Participants MIT Profile für full_name
        return ChatConversation.objects.filter(
            participants=self.request.user
        ).exclude(
            id__in=hidden_ids
        ).prefetch_related(
            'participants',
            'participants__profile',
            'messages'
        )
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ChatConversationDetailSerializer
        return ChatConversationListSerializer
    
    def get_serializer_context(self):
        """Stelle sicher dass jeder Serializer einen frischen Request-Context bekommt"""
        context = super().get_serializer_context()
        # Explizit request hinzufügen um Caching zu vermeiden
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        """Chat-Ersteller ist created_by und wird automatisch als Teilnehmer hinzugefügt"""
        conversation = serializer.save(created_by=self.request.user)
        # Aktuellen User immer als Teilnehmer hinzufügen
        conversation.participants.add(self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Überschreibe create() um nach perform_create() neu zu serialisieren"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # WICHTIG: Nach perform_create() neu laden mit prefetch
        # Damit participants_data vollständig ist (Sender + Empfänger)
        conversation = ChatConversation.objects.prefetch_related(
            'participants',
            'participants__profile'  # Auch Profile prefetchen für full_name
        ).get(pk=serializer.instance.pk)
        
        # WICHTIG: Nutze einen FRISCHEN Serializer mit neuem Kontext
        # um sicherzustellen dass participants_data korrekt geladen wird
        headers = self.get_success_headers(serializer.data)
        output_serializer = ChatConversationListSerializer(
            conversation,
            context={'request': request}
        )
        
        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Alle Nachrichten des Chats (paginiert)"""
        conversation = self.get_object()
        messages = conversation.messages.filter(is_deleted=False).order_by('-sent_at')
        
        paginator = ChatMessagePagination()
        page = paginator.paginate_queryset(messages, request)
        if page is not None:
            serializer = ChatMessageSerializer(
                page, many=True, context={'request': request}
            )
            return paginator.get_paginated_response(serializer.data)
        
        serializer = ChatMessageSerializer(
            messages, many=True, context={'request': request}
        )
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Chat als gelesen markieren"""
        from auth_user.badge_helpers import get_user_badge_counts, send_badge_update
        
        conversation = self.get_object()
        unread_messages = conversation.messages.filter(is_deleted=False).exclude(
            read_by=request.user
        )
        
        count = unread_messages.count()
        
        for message in unread_messages:
            message.read_by.add(request.user)
        
        # Badge-Counts neu berechnen und zurückgeben
        badges = get_user_badge_counts(request.user)
        
        # Auch über WebSocket senden für andere Tabs/Geräte
        send_badge_update(request.user.id, badges)
        
        return Response({
            'status': 'marked_as_read', 
            'count': count,
            'badges': badges  # Neu: Badge-Counts in Response
        })
    
    @action(detail=True, methods=['post'])
    def hide(self, request, pk=None):
        """Chat für aktuellen User löschen/verstecken (WhatsApp-Style)"""
        from .chat_models import ChatConversationHidden
        
        conversation = self.get_object()
        
        # Erstelle oder aktualisiere den Hidden-Eintrag
        ChatConversationHidden.objects.get_or_create(
            conversation=conversation,
            user=request.user
        )
        
        return Response({'status': 'hidden', 'conversation_id': conversation.id})
    
    @action(detail=True, methods=['post'])
    def unhide(self, request, pk=None):
        """Chat wieder einblenden"""
        from .chat_models import ChatConversationHidden
        
        conversation = self.get_object()
        
        # Lösche den Hidden-Eintrag
        ChatConversationHidden.objects.filter(
            conversation=conversation,
            user=request.user
        ).delete()
        
        return Response({'status': 'unhidden', 'conversation_id': conversation.id})


class ChatMessageViewSet(viewsets.ModelViewSet):
    """
    API für Chat-Nachrichten
    
    GET /api/messages/ - Alle eigenen Nachrichten
    POST /api/messages/ - Neue Nachricht senden
    PUT /api/messages/{id}/ - Nachricht bearbeiten
    DELETE /api/messages/{id}/ - Nachricht löschen (soft delete)
    POST /api/messages/{id}/reactions/ - Emoji-Reaktion hinzufügen
    """
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ChatMessagePagination
    
    def get_queryset(self):
        """Nur Nachrichten aus eigenen Chats"""
        return ChatMessage.objects.filter(
            conversation__participants=self.request.user
        ).select_related('sender', 'conversation')
    
    def perform_create(self, serializer):
        """Sender ist aktueller User + WebSocket Notifications senden"""
        message = serializer.save(sender=self.request.user)
        
        # WebSocket Notifications an alle Participants senden (außer Sender)
        conversation = message.conversation
        participant_ids = list(
            conversation.participants.exclude(id=self.request.user.id).values_list('id', flat=True)
        )
        
        # Preview erstellen basierend auf message_type
        if message.message_type == 'file':
            preview = '📎 Datei gesendet'
        elif message.message_type == 'image':
            preview = '🖼️ Bild gesendet'
        else:
            # Text-Nachricht: erste 50 Zeichen
            content = message.content or ''
            preview = content[:50] + '...' if len(content) > 50 else content
        
        # An jeden Participant eine Benachrichtigung senden
        channel_layer = get_channel_layer()
        for user_id in participant_ids:
            async_to_sync(channel_layer.group_send)(
                f'notifications_{user_id}',
                {
                    'type': 'new_message_notification',
                    'conversation_id': conversation.id,
                    'message_id': message.id,
                    'sender': self.request.user.username,
                    'sender_name': self.request.user.get_full_name(),
                    'preview': preview,
                    'timestamp': message.sent_at.isoformat()
                }
            )
        
        # Auch Chat-WebSocket-Gruppe benachrichtigen (für User die gerade im Chat sind)
        async_to_sync(channel_layer.group_send)(
            f'chat_{conversation.id}',
            {
                'type': 'chat_message',
                'message_id': message.id,
                'conversation_id': conversation.id,
                'sender': self.request.user.username,
                'sender_name': self.request.user.get_full_name(),
                'content': message.content or '',
                'message_type': message.message_type,
                'is_encrypted': message.is_encrypted,
                'timestamp': message.sent_at.isoformat()
            }
        )
    
    def perform_update(self, serializer):
        """Nachricht als bearbeitet markieren"""
        serializer.save(is_edited=True)
    
    def perform_destroy(self, instance):
        """Soft delete (Nachricht nicht wirklich löschen)"""
        instance.soft_delete()
    
    @action(detail=True, methods=['post'])
    def reactions(self, request, pk=None):
        """
        Emoji-Reaktion hinzufügen
        POST-Body: {"emoji": "👍"}
        """
        message = self.get_object()
        emoji = request.data.get('emoji')
        
        if not emoji:
            return Response(
                {'error': 'emoji required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        username = request.user.username
        if not message.reactions:
            message.reactions = {}
        
        if emoji not in message.reactions:
            message.reactions[emoji] = []
        
        if username not in message.reactions[emoji]:
            message.reactions[emoji].append(username)
            message.save()
            
            # Send WebSocket notifications
            conversation = message.conversation
            participant_ids = list(
                conversation.participants.exclude(id=request.user.id).values_list('id', flat=True)
            )
            
            channel_layer = get_channel_layer()
            
            # Send to chat participants (real-time update)
            async_to_sync(channel_layer.group_send)(
                f'chat_{conversation.id}',
                {
                    'type': 'message_reaction',
                    'message_id': message.id,
                    'emoji': emoji,
                    'username': username
                }
            )
            
            # Send notification badge to other participants
            for user_id in participant_ids:
                async_to_sync(channel_layer.group_send)(
                    f'notifications_{user_id}',
                    {
                        'type': 'reaction_notification',
                        'conversation_id': conversation.id,
                        'message_id': message.id,
                        'emoji': emoji,
                        'sender': username,
                        'sender_name': request.user.get_full_name(),
                        'preview': f'Hat mit {emoji} reagiert',
                        'timestamp': message.sent_at.isoformat()
                    }
                )
        
        return Response({'reactions': message.reactions})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """
        Nachricht als gelesen markieren
        POST /api/messages/{id}/mark_read/
        """
        message = self.get_object()
        
        # Füge aktuellen User zu read_by hinzu
        if not message.read_by.filter(id=request.user.id).exists():
            message.read_by.add(request.user)
        
        return Response({
            'status': 'marked_as_read',
            'message_id': message.id,
            'read_by_count': message.read_by.count()
        })
    
    @action(detail=True, methods=['delete'])
    def reactions_remove(self, request, pk=None):
        """
        Emoji-Reaktion entfernen
        DELETE /api/messages/{id}/reactions_remove/?emoji=👍
        """
        message = self.get_object()
        emoji = request.query_params.get('emoji')
        
        if not emoji or not message.reactions or emoji not in message.reactions:
            return Response(
                {'error': 'emoji not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        username = request.user.username
        if username in message.reactions[emoji]:
            message.reactions[emoji].remove(username)
            
            if not message.reactions[emoji]:
                del message.reactions[emoji]
            
            message.save()
        
        return Response({'reactions': message.reactions})
