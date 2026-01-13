from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ContactProfile

User = get_user_model()


class ContactProfileSerializer(serializers.ModelSerializer):
    """Serializer für Contact Profile"""
    
    # User-Felder einbinden
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    department = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    job_title = serializers.CharField(source='user.profile.job_title', read_only=True)
    phone_number = serializers.CharField(source='user.profile.phone_number', read_only=True)
    mobil_number = serializers.CharField(source='user.profile.mobile_number', read_only=True)
    
    def get_department(self, obj):
        # Get department from DepartmentMember relationship
        department_member = obj.user.department_memberships.first()
        if department_member and department_member.department:
            return department_member.department.name
        return None
    
    def get_department_id(self, obj):
        # Get department ID from DepartmentMember relationship
        department_member = obj.user.department_memberships.first()
        if department_member and department_member.department:
            return department_member.department.id
        return None
    
    # Computed Fields
    full_phone_number = serializers.CharField(source='get_full_phone_number', read_only=True)
    primary_contact = serializers.CharField(source='get_primary_contact', read_only=True)
    has_emergency_contact = serializers.BooleanField(read_only=True)
    department_display = serializers.CharField(read_only=True)
    
    class Meta:
        model = ContactProfile
        fields = [
            # User-Info
            'user_id', 'username', 'first_name', 'last_name', 'email',
            'department', 'department_id', 'job_title', 'phone_number', 'mobil_number',
            # Contact Profile
            'work_extension', 'private_phone',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
            'office_location', 'desk_number',
            'preferred_contact_method', 'teams_id', 'slack_id',
            'typical_work_hours', 'timezone',
            'notes', 'is_visible_in_directory',
            # Computed
            'full_phone_number', 'primary_contact', 'has_emergency_contact', 'department_display',
            # Timestamps
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ContactDirectorySerializer(serializers.ModelSerializer):
    """Vereinfachter Serializer für Mitarbeiterverzeichnis (ohne sensible Daten)"""
    
    full_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    department = serializers.SerializerMethodField()
    job_title = serializers.CharField(source='user.profile.job_title', read_only=True)
    phone_number = serializers.CharField(source='user.profile.phone_number', read_only=True)
    mobil_number = serializers.CharField(source='user.profile.mobile_number', read_only=True)
    full_phone_number = serializers.CharField(source='get_full_phone_number', read_only=True)
    
    def get_department(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.department:
            return obj.user.profile.department.name
        return None
    
    class Meta:
        model = ContactProfile
        fields = [
            'full_name', 'username', 'email',
            'department', 'job_title', 'office_location',
            'phone_number', 'mobil_number', 'full_phone_number',
            'work_extension', 'teams_id',
        ]
    
    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
