"""
Permission ViewSets & Serializers für API
Ermöglicht Frontend-Admin die Konfiguration von Permissions
"""
from rest_framework import viewsets, serializers, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.db import transaction
from .permission_models import PermissionCode, PermissionMapping
from .permission_service import PermissionService


class PermissionCodeSerializer(serializers.ModelSerializer):
    """Serializer für Permission Codes"""
    
    class Meta:
        model = PermissionCode
        fields = [
            'id', 'code', 'name', 'description', 'category',
            'is_active', 'display_order', 'supports_scope', 'default_scope',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PermissionMappingSerializer(serializers.ModelSerializer):
    """Serializer für Permission Mappings"""
    permission_detail = PermissionCodeSerializer(source='permission', read_only=True)
    entity_display_name = serializers.CharField(source='get_entity_display_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = PermissionMapping
        fields = [
            'id', 'entity_type', 'entity_id', 'permission', 'permission_detail',
            'entity_display_name', 'scope', 'object_type', 'object_id', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
    def create(self, validated_data):
        """Set created_by automatisch"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class BulkPermissionMappingSerializer(serializers.Serializer):
    """Serializer für Bulk-Update von Permissions"""
    entity_type = serializers.ChoiceField(choices=PermissionMapping.ENTITY_TYPE_CHOICES)
    entity_id = serializers.IntegerField()
    permission_codes = serializers.ListField(
        child=serializers.CharField(),
        help_text='Liste von Permission Codes'
    )
    permission_scopes = serializers.DictField(
        child=serializers.ChoiceField(choices=PermissionCode.SCOPE_CHOICES, allow_null=True),
        required=False,
        help_text='Optional: Scopes für Permissions (permission_code -> scope)'
    )


class PermissionCodeViewSet(viewsets.ModelViewSet):
    """
    API für Permission Codes
    
    GET /api/permission-codes/ - Liste aller Permission Codes
    GET /api/permission-codes/{id}/ - Detail
    POST /api/permission-codes/ - Neuen Code anlegen (nur Admin)
    PUT /api/permission-codes/{id}/ - Ändern (nur Admin)
    DELETE /api/permission-codes/{id}/ - Löschen (nur Admin)
    GET /api/permission-codes/by-category/ - Gruppiert nach Kategorie
    """
    queryset = PermissionCode.objects.all()
    serializer_class = PermissionCodeSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['category', 'display_order', 'code']
    ordering = ['category', 'display_order']
    pagination_class = None
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Gibt Permissions gruppiert nach Kategorie zurück"""
        categories = {}
        
        for perm in self.get_queryset().filter(is_active=True):
            category = perm.category
            if category not in categories:
                categories[category] = []
            
            categories[category].append(
                PermissionCodeSerializer(perm).data
            )
        
        return Response(categories)


class PermissionMappingViewSet(viewsets.ModelViewSet):
    """
    API für Permission Mappings
    
    GET /api/permission-mappings/ - Liste aller Mappings
    GET /api/permission-mappings/{id}/ - Detail
    POST /api/permission-mappings/ - Neues Mapping (nur Admin)
    PUT /api/permission-mappings/{id}/ - Ändern (nur Admin)
    DELETE /api/permission-mappings/{id}/ - Löschen (nur Admin)
    
    Filter:
    - entity_type: DEPARTMENT, ROLE, SPECIALTY, GROUP
    - entity_id: ID der Entity
    - permission: Permission Code ID
    - is_active: true/false
    
    GET /api/permission-mappings/for-entity/?entity_type=DEPARTMENT&entity_id=1
    POST /api/permission-mappings/bulk-update/
    POST /api/permission-mappings/clear-cache/
    """
    queryset = PermissionMapping.objects.select_related(
        'permission', 'created_by'
    ).all()
    serializer_class = PermissionMappingSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['permission__code', 'permission__name']
    
    def get_queryset(self):
        """Filter nach Query-Parametern"""
        queryset = super().get_queryset()
        
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        
        permission_id = self.request.query_params.get('permission')
        if permission_id:
            queryset = queryset.filter(permission_id=permission_id)
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def for_entity(self, request):
        """
        Gibt alle Permissions für eine Entity zurück
        
        Query Params:
        - entity_type: DEPARTMENT, ROLE, SPECIALTY, GROUP
        - entity_id: ID der Entity
        """
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')
        
        if not entity_type or not entity_id:
            return Response(
                {'error': 'entity_type and entity_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        mappings = PermissionMapping.objects.filter(
            entity_type=entity_type,
            entity_id=entity_id,
            is_active=True
        ).select_related('permission')
        
        serializer = self.get_serializer(mappings, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk-Update von Permissions für eine Entity
        
        Body:
        {
            "entity_type": "DEPARTMENT",
            "entity_id": 1,
            "permission_codes": ["can_view_workorders", "can_edit_workorders"],
            "permission_scopes": {"can_view_workorders": "ALL", "can_edit_workorders": "OWN"}
        }
        
        Setzt die Permissions für die Entity auf GENAU diese Liste
        (entfernt alle anderen, fügt neue hinzu)
        """
        serializer = BulkPermissionMappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        entity_type = serializer.validated_data['entity_type']
        entity_id = serializer.validated_data['entity_id']
        permission_codes = serializer.validated_data['permission_codes']
        permission_scopes = serializer.validated_data.get('permission_scopes', {})
        
        with transaction.atomic():
            # Alle bestehenden Mappings deaktivieren
            PermissionMapping.objects.filter(
                entity_type=entity_type,
                entity_id=entity_id
            ).update(is_active=False)
            
            # Neue Mappings erstellen/aktivieren
            created_count = 0
            updated_count = 0
            
            for code in permission_codes:
                try:
                    permission = PermissionCode.objects.get(code=code, is_active=True)
                except PermissionCode.DoesNotExist:
                    continue
                
                # Hole Scope für diese Permission (falls angegeben)
                scope = permission_scopes.get(code)
                
                mapping, created = PermissionMapping.objects.update_or_create(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    permission=permission,
                    object_type='',
                    object_id=None,
                    defaults={
                        'is_active': True,
                        'scope': scope,  # NEU: Setze Scope
                        'created_by': request.user
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            
            # Cache für alle betroffenen User löschen
            PermissionService.clear_all_caches()
        
        return Response({
            'message': 'Permissions updated',
            'created': created_count,
            'updated': updated_count,
            'entity_type': entity_type,
            'entity_id': entity_id
        })
    
    @action(detail=False, methods=['post'])
    def clear_cache(self, request):
        """Löscht Permission-Cache für alle User"""
        PermissionService.clear_all_caches()
        return Response({'message': 'Permission cache cleared'})
