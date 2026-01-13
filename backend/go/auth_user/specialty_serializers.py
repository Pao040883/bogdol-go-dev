"""
Serializers für Specialty-Related Models
"""
from rest_framework import serializers
from .profile_models import (
    Specialty, MemberSpecialty, WorkorderAssignment, SubstituteAssignment,
    Department, DepartmentMember, DepartmentRole
)
from django.contrib.auth import get_user_model
from .hr_assignment_serializer import UserMiniSerializer

User = get_user_model()


class SpecialtySerializer(serializers.ModelSerializer):
    """Serializer für Fachbereiche"""
    department_name = serializers.CharField(source='department.name', read_only=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    full_path = serializers.CharField(read_only=True)
    
    class Meta:
        model = Specialty
        fields = [
            'id', 'department', 'department_name', 'name', 'code', 
            'description', 'parent', 'parent_name', 'full_path',
            'search_keywords', 'display_order', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class MemberSpecialtySerializer(serializers.ModelSerializer):
    """Serializer für Fachbereichs-Zuordnungen"""
    specialty_data = SpecialtySerializer(source='specialty', read_only=True)
    member_data = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(source='member.user.id', read_only=True)
    user_name = serializers.CharField(source='member.user.get_full_name', read_only=True)
    department_name = serializers.CharField(source='member.department.name', read_only=True)
    
    class Meta:
        model = MemberSpecialty
        fields = [
            'id', 'member', 'member_data', 'specialty', 'specialty_data',
            'user_id', 'user_name', 'department_name',
            'proficiency_level', 'is_primary', 
            'start_date', 'end_date', 'is_active', 'created_at'
        ]
        read_only_fields = ['created_at']
    
    def get_member_data(self, obj):
        return {
            'id': obj.member.id,
            'user_id': obj.member.user.id,
            'user_name': obj.member.user.get_full_name(),
            'department': obj.member.department.name,
            'role': obj.member.role.name if obj.member.role else None
        }


class DepartmentMemberDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für DepartmentMember inkl. Specialties"""
    user_data = serializers.SerializerMethodField()
    department_data = serializers.SerializerMethodField()
    role_data = serializers.SerializerMethodField()
    specialties = SpecialtySerializer(many=True, read_only=True)
    specialty_assignments = MemberSpecialtySerializer(many=True, read_only=True)
    reports_to_name = serializers.CharField(source='reports_to.user.get_full_name', read_only=True)
    
    # Für Create/Update: Specialty IDs
    specialty_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Specialty.objects.all(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = DepartmentMember
        fields = [
            'id', 'user', 'user_data', 'department', 'department_data',
            'role', 'role_data', 'specialties', 'specialty_assignments',
            'specialty_ids', 'reports_to', 'reports_to_name',
            'position_title', 'display_order', 'start_date', 'end_date',
            'is_primary', 'is_staff_position', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_user_data(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'full_name': obj.user.get_full_name(),
            'email': obj.user.email
        }
    
    def get_department_data(self, obj):
        return {
            'id': obj.department.id,
            'name': obj.department.name,
            'code': obj.department.code,
            'is_staff_department': obj.department.is_staff_department
        }
    
    def get_role_data(self, obj):
        if not obj.role:
            return None
        return {
            'id': obj.role.id,
            'name': obj.role.name,
            'code': obj.role.code,
            'hierarchy_level': obj.role.hierarchy_level
        }
    
    def create(self, validated_data):
        specialty_ids = validated_data.pop('specialty_ids', [])
        member = super().create(validated_data)
        
        # Erstelle MemberSpecialty Zuordnungen
        for specialty in specialty_ids:
            MemberSpecialty.objects.create(
                member=member,
                specialty=specialty,
                is_active=True
            )
        
        return member
    
    def update(self, instance, validated_data):
        specialty_ids = validated_data.pop('specialty_ids', None)
        instance = super().update(instance, validated_data)
        
        # Update Specialties falls übergeben
        if specialty_ids is not None:
            # Deaktiviere alle bestehenden
            instance.specialty_assignments.update(is_active=False)
            
            # Erstelle/Aktiviere neue
            for specialty in specialty_ids:
                MemberSpecialty.objects.update_or_create(
                    member=instance,
                    specialty=specialty,
                    defaults={'is_active': True}
                )
        
        return instance


class WorkorderAssignmentSerializer(serializers.ModelSerializer):
    """Serializer für Arbeitsschein-Zuordnungen"""
    submitter_details = UserMiniSerializer(source='submitter', read_only=True)
    processor_details = UserMiniSerializer(source='processor', read_only=True)
    specialty_data = SpecialtySerializer(source='specialty', read_only=True)
    
    # submitter_id as input field
    submitter_id = serializers.IntegerField(write_only=True, required=True, source='submitter')
    
    # Legacy fields for compatibility
    submitter_name = serializers.CharField(source='submitter.get_full_name', read_only=True)
    processor_name = serializers.CharField(source='processor.get_full_name', read_only=True)
    
    class Meta:
        model = WorkorderAssignment
        fields = [
            'id', 'submitter', 'submitter_id', 'submitter_name', 'submitter_details',
            'processor', 'processor_name', 'processor_details',
            'specialty', 'specialty_data', 'is_auto_assigned',
            'valid_from', 'valid_until', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'submitter', 'processor', 'created_at', 'updated_at']
        extra_kwargs = {
            'specialty': {'required': False}
        }
    
    def validate_submitter_id(self, value):
        """Validate that submitter exists and is active"""
        try:
            from .models import CustomUser
            user = CustomUser.objects.get(id=value, is_active=True)
            return value
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(f'User mit ID {value} existiert nicht oder ist nicht aktiv')


class SubstituteAssignmentSerializer(serializers.ModelSerializer):
    """Serializer für Vertretungs-Zuordnungen"""
    original_user_name = serializers.CharField(source='original_user.get_full_name', read_only=True)
    substitute_user_name = serializers.CharField(source='substitute_user.get_full_name', read_only=True)
    absence_data = serializers.SerializerMethodField()
    specialties_data = SpecialtySerializer(source='specialties', many=True, read_only=True)
    
    # Für Create/Update
    specialty_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Specialty.objects.all(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = SubstituteAssignment
        fields = [
            'id', 'absence', 'absence_data', 'original_user', 'original_user_name',
            'substitute_user', 'substitute_user_name', 'specialties', 'specialties_data',
            'specialty_ids', 'is_active', 'created_at'
        ]
        read_only_fields = ['created_at']
    
    def get_absence_data(self, obj):
        return {
            'id': obj.absence.id,
            'start_date': obj.absence.start_date,
            'end_date': obj.absence.end_date,
            'status': obj.absence.status,
            'absence_type': obj.absence.absence_type.display_name if obj.absence.absence_type else None
        }
    
    def create(self, validated_data):
        specialty_ids = validated_data.pop('specialty_ids', [])
        assignment = super().create(validated_data)
        
        if specialty_ids:
            assignment.specialties.set(specialty_ids)
        
        return assignment
    
    def update(self, instance, validated_data):
        specialty_ids = validated_data.pop('specialty_ids', None)
        instance = super().update(instance, validated_data)
        
        if specialty_ids is not None:
            instance.specialties.set(specialty_ids)
        
        return instance
