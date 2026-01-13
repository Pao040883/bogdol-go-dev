from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    WorkOrderClient, WorkObject, WorkOrder, WorkOrderTemplate,
    RecurringWorkOrderChecklist
)
from .history_models import WorkOrderHistory
from auth_user.profile_models import WorkorderAssignment, Specialty

User = get_user_model()


class ClientSerializer(serializers.ModelSerializer):
    """Serializer für Kunden"""
    
    class Meta:
        model = WorkOrderClient
        fields = [
            'id', 'name', 'street', 'postal_code', 'city', 
            'phone', 'email', 'is_active', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkObjectSerializer(serializers.ModelSerializer):
    """Serializer für Objekte"""
    client_name = serializers.CharField(source='client.name', read_only=True)
    
    class Meta:
        model = WorkObject
        fields = [
            'id', 'client', 'client_name', 'name', 
            'street', 'postal_code', 'city',
            'contact_person', 'contact_phone',
            'notes', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserMiniSerializer(serializers.ModelSerializer):
    """Mini User Serializer"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email']
        read_only_fields = fields
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class WorkOrderTemplateSerializer(serializers.ModelSerializer):
    """Serializer für Arbeitsschein-Vorlagen"""
    client_name = serializers.CharField(source='client.name', read_only=True)
    work_object_name = serializers.CharField(source='work_object.name', read_only=True)
    
    class Meta:
        model = WorkOrderTemplate
        fields = [
            'id', 'name', 'description',
            'client', 'client_name',
            'work_object', 'work_object_name',
            'work_type', 'work_description',
            'work_days', 'work_schedule',
            'customer_notes', 'internal_notes',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreateFromTemplateSerializer(serializers.Serializer):
    """Serializer zum Erstellen eines Arbeitsscheins aus Vorlage"""
    template_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    project_number = serializers.CharField(required=False, allow_blank=True, default='')
    
    def validate_template_id(self, value):
        try:
            template = WorkOrderTemplate.objects.get(id=value, is_active=True)
            return template
        except WorkOrderTemplate.DoesNotExist:
            raise serializers.ValidationError('Vorlage nicht gefunden')
    
    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError({
                'end_date': 'Enddatum muss nach Startdatum liegen'
            })
        return data


class WorkOrderSerializer(serializers.ModelSerializer):
    """Serializer für Arbeitsscheine"""
    client_name = serializers.CharField(source='client.name', read_only=True)
    client_details = ClientSerializer(source='client', read_only=True)
    work_object_name = serializers.CharField(source='work_object.name', read_only=True)
    work_object_details = WorkObjectSerializer(source='work_object', read_only=True)
    assigned_to_details = UserMiniSerializer(source='assigned_to', read_only=True)
    created_by_details = UserMiniSerializer(source='created_by', read_only=True)
    submitted_by_details = UserMiniSerializer(source='submitted_by', read_only=True)
    reviewed_by_details = UserMiniSerializer(source='reviewed_by', read_only=True)
    pdf_downloaded_by_details = UserMiniSerializer(source='pdf_downloaded_by', read_only=True)
    duplicate_of_details = serializers.SerializerMethodField()
    checklist_match = serializers.SerializerMethodField()
    optimized_filename = serializers.SerializerMethodField()
    responsible_billing_user = serializers.SerializerMethodField()
    can_mark_billed = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    def get_duplicate_of_details(self, obj):
        """Gibt Details zum Original-Arbeitsschein zurück wenn Duplikat"""
        if obj.duplicate_of:
            return {
                'id': obj.duplicate_of.id,
                'order_number': obj.duplicate_of.order_number,
                'created_at': obj.duplicate_of.created_at,
                'status': obj.duplicate_of.status
            }
        return None
    
    def get_checklist_match(self, obj):
        """Gibt den passenden Haklisten-Eintrag zurück"""
        match = obj.match_checklist_item()
        if match:
            return {
                'id': match.id,
                'object_number': match.object_number,
                'project_number': match.project_number,
                'sr_invoice_number': match.sr_invoice_number,
                'notes': match.notes,
                'checked_this_month': match.checked_this_month,
                'service_manager': UserMiniSerializer(match.service_manager).data if match.service_manager else None,
                'assigned_billing_user': UserMiniSerializer(match.assigned_billing_user).data if match.assigned_billing_user else None
            }
        return None
    
    def get_optimized_filename(self, obj):
        """Gibt den optimierten Dateinamen zurück"""
        return obj.get_optimized_filename()
    
    def get_responsible_billing_user(self, obj):
        """Gibt den zuständigen Faktura-Mitarbeiter zurück (inkl. Vertretung)"""
        responsible = obj.get_responsible_billing_user()
        if responsible:
            return UserMiniSerializer(responsible).data
        return None
    
    def get_can_mark_billed(self, obj):
        """Prüft ob der aktuelle User den Schein abrechnen darf"""
        request = self.context.get('request')
        if request and request.user:
            return obj.can_mark_billed(request.user)
        return False
    
    def get_can_cancel(self, obj):
        """Prüft ob der aktuelle User den Schein stornieren darf"""
        request = self.context.get('request')
        if request and request.user:
            return obj.can_cancel(request.user)
        return False
    
    class Meta:
        model = WorkOrder
        fields = [
            'id', 'order_number', 'object_number', 'project_number', 'template',
            'client', 'client_name', 'client_details',
            'work_object', 'work_object_name', 'work_object_details',
            'work_type', 'work_description',
            'start_date', 'end_date', 'month', 'work_days', 'work_schedule',
            'leistungsmonat', 'leistungsmonat_ocr_confidence',
            'assigned_to', 'assigned_to_details',
            'created_by', 'created_by_details',
            'submitted_at', 'submitted_by', 'submitted_by_details',
            'reviewed_at', 'reviewed_by', 'reviewed_by_details',
            'is_duplicate', 'duplicate_of', 'duplicate_of_details', 'duplicate_checked_at',
            'pdf_downloaded', 'pdf_downloaded_at', 'pdf_downloaded_by', 'pdf_downloaded_by_details',
            'checklist_match', 'optimized_filename',
            'responsible_billing_user', 'can_mark_billed', 'can_cancel',
            'status', 'status_display',
            'scanned_document',
            'customer_signature', 'customer_signed_at',
            'company_signature',
            'customer_notes', 'internal_notes',
            'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'order_number', 'created_at', 'updated_at', 
            'completed_at', 'customer_signed_at', 'submitted_at', 'reviewed_at',
            'is_duplicate', 'duplicate_of', 'duplicate_checked_at',
            'pdf_downloaded', 'pdf_downloaded_at', 'pdf_downloaded_by'
        ]
    
    def create(self, validated_data):
        # Set created_by from request user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class WorkOrderSignatureSerializer(serializers.Serializer):
    """Serializer für Unterschrift"""
    signature_data = serializers.CharField(help_text='Base64 encoded signature image')
    
    def validate_signature_data(self, value):
        """Validate that signature data is base64 encoded"""
        import base64
        try:
            if value.startswith('data:image'):
                # Extract base64 part from data URL
                value = value.split(',')[1]
            base64.b64decode(value)
            return value
        except Exception:
            raise serializers.ValidationError('Invalid signature data format')


class WorkOrderHistorySerializer(serializers.ModelSerializer):
    """Serializer für WorkOrder History/Audit Trail"""
    performed_by_details = UserMiniSerializer(source='performed_by', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = WorkOrderHistory
        fields = [
            'id', 'work_order', 'action', 'action_display',
            'performed_by', 'performed_by_details',
            'performed_at', 'old_status', 'new_status',
            'notes', 'metadata'
        ]
        read_only_fields = fields


class RecurringWorkOrderChecklistSerializer(serializers.ModelSerializer):
    """Serializer für Hakliste"""
    client_name = serializers.CharField(source='client.name', read_only=True)
    work_object_name = serializers.CharField(source='work_object.name', read_only=True)
    created_by_details = UserMiniSerializer(source='created_by', read_only=True)
    last_checked_by_details = UserMiniSerializer(source='last_checked_by', read_only=True)
    service_manager_details = UserMiniSerializer(source='service_manager', read_only=True)
    assigned_billing_user_details = UserMiniSerializer(source='assigned_billing_user', read_only=True)
    matching_workorders_count = serializers.SerializerMethodField()
    
    def get_matching_workorders_count(self, obj):
        """Zählt wie viele Arbeitsscheine zu diesem Eintrag passen"""
        from django.utils import timezone
        current_month = timezone.now().strftime('%Y-%m')
        
        return WorkOrder.objects.filter(
            object_number=obj.object_number,
            project_number=obj.project_number,
            start_date__year=timezone.now().year,
            start_date__month=timezone.now().month
        ).count()
    
    class Meta:
        model = RecurringWorkOrderChecklist
        fields = [
            'id', 'object_number', 'object_description', 'project_number',
            'debitor_number', 'notes', 'sr_invoice_number',
            'client', 'client_name',
            'work_object', 'work_object_name',
            'service_manager', 'service_manager_details',
            'assigned_billing_user', 'assigned_billing_user_details',
            'current_month', 'checked_this_month',
            'last_checked_at', 'last_checked_by', 'last_checked_by_details',
            'matching_workorders_count',
            'valid_from', 'valid_until',
            'is_active', 'created_at', 'created_by', 'created_by_details', 'updated_at'
        ]
        read_only_fields = [
            'id', 'current_month', 'checked_this_month',
            'last_checked_at', 'last_checked_by', 'created_at', 'updated_at'
        ]
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            # Wenn kein assigned_billing_user gesetzt, nutze aktuellen User (falls Faktur-MA)
            if not validated_data.get('assigned_billing_user'):
                validated_data['assigned_billing_user'] = request.user
        return super().create(validated_data)


class WorkorderAssignmentSerializer(serializers.ModelSerializer):
    """Serializer für WorkorderAssignment (Einreicher → Faktur-MA)"""
    submitter_details = UserMiniSerializer(source='submitter', read_only=True)
    processor_details = UserMiniSerializer(source='processor', read_only=True)
    specialty_name = serializers.CharField(source='specialty.name', read_only=True)
    specialty_code = serializers.CharField(source='specialty.code', read_only=True)
    
    class Meta:
        model = WorkorderAssignment
        fields = [
            'id', 'submitter', 'submitter_details',
            'processor', 'processor_details',
            'specialty', 'specialty_name', 'specialty_code',
            'is_auto_assigned', 'valid_from', 'valid_until',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validierung: Processor muss Faktur-Specialty haben"""
        from auth_user.profile_models import MemberSpecialty
        
        processor = data.get('processor')
        specialty = data.get('specialty')
        
        if processor and specialty:
            # Check: Processor hat diese Specialty?
            has_specialty = MemberSpecialty.objects.filter(
                member__user=processor,
                specialty=specialty,
                is_active=True
            ).exists()
            
            if not has_specialty:
                raise serializers.ValidationError({
                    'processor': f'{processor.get_full_name()} hat keine Zuordnung zu {specialty.name}'
                })
        
        # Check: valid_from < valid_until
        if data.get('valid_from') and data.get('valid_until'):
            if data['valid_from'] > data['valid_until']:
                raise serializers.ValidationError({
                    'valid_until': 'Enddatum muss nach Startdatum liegen'
                })
        
        return data
