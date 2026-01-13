"""
FakturaAssignment Serializer - Separate file to avoid circular imports
"""
from rest_framework import serializers
from .models import CustomUser
from .profile_models import FakturaAssignment


class UserMiniSerializer(serializers.ModelSerializer):
    """Mini User Serializer für Details in anderen Serializers"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email']
        read_only_fields = fields
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class FakturaAssignmentSerializer(serializers.ModelSerializer):
    """Serializer für FakturaAssignment (Employee → Faktura-MA)"""
    employee_details = UserMiniSerializer(source='employee', read_only=True)
    faktura_processor_details = UserMiniSerializer(source='faktura_processor', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    # employee_id as input field
    employee_id = serializers.IntegerField(write_only=True, required=True)
    
    class Meta:
        model = FakturaAssignment
        fields = [
            'id', 'employee', 'employee_id', 'employee_details',
            'faktura_processor', 'faktura_processor_details',
            'department', 'department_name',
            'valid_from', 'valid_until',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'faktura_processor', 'created_at', 'updated_at']
        extra_kwargs = {
            'department': {'required': False}
        }
    
    def validate(self, data):
        """Validierung"""
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
    
    def create(self, validated_data):
        """Create new assignment - Convert employee_id to employee instance"""
        employee_id = validated_data.pop('employee_id')
        employee = CustomUser.objects.get(id=employee_id)
        
        return FakturaAssignment.objects.create(
            employee=employee,
            **validated_data
        )
    
    def update(self, instance, validated_data):
        """Update assignment - Handle employee_id if present"""
        if 'employee_id' in validated_data:
            employee_id = validated_data.pop('employee_id')
            instance.employee = CustomUser.objects.get(id=employee_id)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance
