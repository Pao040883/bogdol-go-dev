"""
Permission Matrix Serializers
Serializer für die neue Permission-Matrix-Ansicht basierend auf PermissionService
"""
from rest_framework import serializers
from .permission_models import PermissionCode, PermissionMapping
from .profile_models import Department, DepartmentRole, MemberSpecialty
from django.contrib.auth.models import Group


class PermissionCodeSerializer(serializers.ModelSerializer):
    """Serializer für PermissionCode"""
    
    class Meta:
        model = PermissionCode
        fields = ['id', 'code', 'name', 'category', 'supports_scope', 'default_scope', 'is_active']


class EntitySerializer(serializers.Serializer):
    """Generic Entity Serializer für Permission-Sources"""
    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField(required=False, allow_null=True)
    display = serializers.CharField()


class PermissionMappingDetailSerializer(serializers.Serializer):
    """Detaillierter Serializer für Permission Mappings mit Source-Details"""
    permission = PermissionCodeSerializer()
    source_type = serializers.CharField()
    source = EntitySerializer()
    scope = serializers.CharField(allow_null=True)
    is_effective = serializers.BooleanField()
    mapping_id = serializers.IntegerField()


class EffectivePermissionSerializer(serializers.Serializer):
    """Serializer für effektive Permissions (aggregiert)"""
    code = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField()
    scope = serializers.CharField(allow_null=True)
    sources = serializers.ListField(child=serializers.CharField())
    supports_scope = serializers.BooleanField()


class PermissionFromEntitySerializer(serializers.Serializer):
    """Permissions die von einer Entity kommen"""
    code = serializers.CharField()
    name = serializers.CharField()
    scope = serializers.CharField(allow_null=True)
    mapping_id = serializers.IntegerField()


class DepartmentWithPermissionsSerializer(serializers.Serializer):
    """Department mit zugehörigen Permissions"""
    department = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    is_primary = serializers.BooleanField()
    permissions_from_department = PermissionFromEntitySerializer(many=True)
    permissions_from_role = PermissionFromEntitySerializer(many=True)
    
    def get_department(self, obj):
        dept = obj['department_obj']
        return {
            'id': dept.id,
            'name': dept.name,
            'code': dept.code
        }
    
    def get_role(self, obj):
        role = obj.get('role_obj')
        if not role:
            return None
        return {
            'id': role.id,
            'name': role.name,
            'code': role.code,
            'hierarchy_level': role.hierarchy_level
        }


class SpecialtyWithPermissionsSerializer(serializers.Serializer):
    """Specialty mit zugehörigen Permissions"""
    specialty = serializers.SerializerMethodField()
    is_active = serializers.BooleanField()
    is_primary = serializers.BooleanField()
    proficiency_level = serializers.IntegerField()
    permissions_from_specialty = PermissionFromEntitySerializer(many=True)
    
    def get_specialty(self, obj):
        specialty = obj['specialty_obj']
        return {
            'id': specialty.id,
            'name': specialty.name,
            'code': specialty.code
        }


class GroupWithPermissionsSerializer(serializers.Serializer):
    """Group mit zugehörigen Permissions"""
    group = serializers.SerializerMethodField()
    permissions_from_group = PermissionFromEntitySerializer(many=True)
    
    def get_group(self, obj):
        group = obj['group_obj']
        return {
            'id': group.id,
            'name': group.name
        }


class PermissionSummarySerializer(serializers.Serializer):
    """Summary der Permissions"""
    total_permissions = serializers.IntegerField()
    total_mappings = serializers.IntegerField()
    has_full_access = serializers.BooleanField()
    permissions_by_category = serializers.DictField()
    permissions_by_scope = serializers.DictField()
    permissions_by_source = serializers.DictField()


class UserBasicInfoSerializer(serializers.Serializer):
    """Basic User Info"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_superuser = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    is_active = serializers.BooleanField()


class LegacyAssignmentSerializer(serializers.Serializer):
    """Legacy HR/Workorder Assignments (deprecated)"""
    hr_assignments = serializers.ListField()
    workorder_assignments = serializers.ListField()
    object_permissions = serializers.ListField()


class UserPermissionMatrixSerializer(serializers.Serializer):
    """Haupt-Serializer für Permission Matrix"""
    user = UserBasicInfoSerializer()
    has_full_access = serializers.BooleanField()
    permission_mappings = PermissionMappingDetailSerializer(many=True)
    effective_permissions = EffectivePermissionSerializer(many=True)
    departments = DepartmentWithPermissionsSerializer(many=True)
    specialties = SpecialtyWithPermissionsSerializer(many=True)
    groups = GroupWithPermissionsSerializer(many=True)
    summary = PermissionSummarySerializer()
    legacy = LegacyAssignmentSerializer(required=False)
