"""
HRAssignment Serializer - Separate file to avoid circular imports
"""
from rest_framework import serializers
from .models import CustomUser
from .profile_models import HRAssignment


class UserMiniSerializer(serializers.ModelSerializer):
    """Mini User Serializer für Details in anderen Serializers"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email']
        read_only_fields = fields
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class HRAssignmentSerializer(serializers.ModelSerializer):
    """Serializer für HRAssignment (Employee → HR-MA)"""
    employee_details = UserMiniSerializer(source='employee', read_only=True)
    hr_processor_details = UserMiniSerializer(source='hr_processor', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    # employee_id as input field
    employee_id = serializers.IntegerField(write_only=True, required=True, source='employee')
    
    class Meta:
        model = HRAssignment
        fields = [
            'id', 'employee', 'employee_id', 'employee_details',
            'hr_processor', 'hr_processor_details',
            'department', 'department_name',
            'valid_from', 'valid_until',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'hr_processor', 'created_at', 'updated_at']
        extra_kwargs = {
            'department': {'required': False}
        }
    
    def validate(self, data):
        """Validierung: HR-Processor muss in HR-Gruppe sein"""
        # hr_processor wird in perform_create gesetzt, nicht aus data
        # Wir validieren nur employee und department hier
        
        # Check: valid_from < valid_until
        if data.get('valid_from') and data.get('valid_until'):
            if data['valid_from'] > data['valid_until']:
                raise serializers.ValidationError({
                    'valid_until': 'Enddatum muss nach Startdatum liegen'
                })
        
        return data
    
    def validate_employee_id(self, value):
        """Validate that employee exists and is active"""
        try:
            user = CustomUser.objects.get(id=value, is_active=True)
            return value
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(f'User mit ID {value} existiert nicht oder ist nicht aktiv')
