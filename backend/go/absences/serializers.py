from rest_framework import serializers
from .models import Absence, AbsenceType, AbsenceConflict, AbsenceComment
from django.contrib.auth import get_user_model
from django.utils import timezone


class AbsenceTypeSerializer(serializers.ModelSerializer):
    """Serializer für Abwesenheitstypen"""
    
    class Meta:
        model = AbsenceType
        fields = [
            'id', 'name', 'display_name', 'description', 
            'requires_approval', 'requires_certificate', 
            'advance_notice_days', 'max_consecutive_days', 
            'color', 'icon', 'deduct_from_vacation',
            'is_active'
        ]
        read_only_fields = ['id']


class UserMiniSerializer(serializers.ModelSerializer):
    """Mini-Serializer für User-Informationen"""
    full_name = serializers.SerializerMethodField()
    remaining_vacation_days = serializers.SerializerMethodField()
    used_vacation_days = serializers.SerializerMethodField()
    vacation_entitlement = serializers.SerializerMethodField()
    carryover_vacation = serializers.SerializerMethodField()
    vacation_year = serializers.SerializerMethodField()
    
    class Meta:
        model = get_user_model()
        fields = [
            'id', 'username', 'first_name', 'last_name', 'full_name', 'email',
            'vacation_entitlement', 'carryover_vacation', 'vacation_year',
            'remaining_vacation_days', 'used_vacation_days'
        ]
        read_only_fields = ['id', 'username', 'email']
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username
    
    def get_vacation_entitlement(self, obj):
        return obj.profile.vacation_entitlement if hasattr(obj, 'profile') and obj.profile else 0
    
    def get_carryover_vacation(self, obj):
        return obj.profile.carryover_vacation if hasattr(obj, 'profile') and obj.profile else 0
    
    def get_vacation_year(self, obj):
        return obj.profile.vacation_year if hasattr(obj, 'profile') and obj.profile else timezone.now().year
    
    def get_remaining_vacation_days(self, obj):
        return obj.get_remaining_vacation_days()
    
    def get_used_vacation_days(self, obj):
        return obj.get_used_vacation_days()


class AbsenceConflictSerializer(serializers.ModelSerializer):
    """Serializer für Abwesenheitskonflikte"""
    conflicting_absence = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = AbsenceConflict
        fields = [
            'id', 'conflict_type', 'conflicting_absence', 
            'description', 'severity', 'resolved', 
            'resolution_comment', 'created_at', 'resolved_at'
        ]
        read_only_fields = ['id', 'created_at', 'resolved_at']


class AbsenceCommentSerializer(serializers.ModelSerializer):
    """Serializer für Abwesenheits-Kommentare"""
    author = UserMiniSerializer(read_only=True)
    author_name = serializers.SerializerMethodField()
    
    class Meta:
        model = AbsenceComment
        fields = [
            'id', 'absence', 'author', 'author_name', 'comment_type', 
            'content', 'is_internal', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
    
    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username


class AbsenceSerializer(serializers.ModelSerializer):
    """Erweiterter Serializer für Abwesenheiten"""
    user = UserMiniSerializer(read_only=True)
    absence_type = AbsenceTypeSerializer(read_only=True)
    absence_type_id = serializers.IntegerField(write_only=True)
    representative = UserMiniSerializer(read_only=True)
    representative_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    approved_by = UserMiniSerializer(read_only=True)
    rejected_by = UserMiniSerializer(read_only=True)
    hr_processed_by = UserMiniSerializer(read_only=True)
    revision_of = serializers.PrimaryKeyRelatedField(read_only=True)
    conflicts = AbsenceConflictSerializer(many=True, read_only=True)
    comments = AbsenceCommentSerializer(many=True, read_only=True)
    
    # Computed fields
    duration_days = serializers.ReadOnlyField()
    workday_duration = serializers.ReadOnlyField()
    is_pending = serializers.ReadOnlyField()
    is_approved = serializers.ReadOnlyField()
    is_rejected = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Absence
        fields = [
            'id', 'user', 'absence_type', 'absence_type_id',
            'start_date', 'end_date', 'manual_duration_days', 'reason', 'status', 'status_display',
            'approved_by', 'approved_at', 'approval_comment',
            'rejected_by', 'rejected_at', 'rejection_reason',
            'representative', 'representative_id', 'representative_confirmed', 'representative_confirmed_at',
            'hr_notified', 'hr_notified_at', 'hr_comment',
            'hr_processed', 'hr_processed_by', 'hr_processed_at',
            'is_revision', 'revision_of', 'revision_reason',
            'certificate', 'additional_documents',
            'created_at', 'updated_at', 'conflicts', 'comments',
            'duration_days', 'workday_duration', 'is_pending', 'is_approved', 'is_rejected',
            # Legacy field für Rückwärtskompatibilität
            'approved'
        ]
        read_only_fields = [
            'id', 'user', 'status', 'approved_by', 'approved_at', 'approval_comment',
            'rejected_by', 'rejected_at', 'rejection_reason',
            'representative_confirmed', 'representative_confirmed_at',
            'hr_notified', 'hr_notified_at', 'hr_comment',
            'created_at', 'updated_at', 'approved'
        ]
    
    def validate(self, data):
        """Erweiterte Validierung"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        absence_type_id = data.get('absence_type_id')
        
        # Basis-Datumsprüfung
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                'end_date': 'Enddatum muss nach dem Startdatum liegen.'
            })
        
        # AbsenceType Validierung
        if absence_type_id:
            try:
                absence_type = AbsenceType.objects.get(id=absence_type_id, is_active=True)
                data['absence_type'] = absence_type
            except AbsenceType.DoesNotExist:
                raise serializers.ValidationError({
                    'absence_type_id': 'Ungültiger Abwesenheitstyp.'
                })
        
        return data

    def validate(self, data):
        """Erweiterte Validierung mit Urlaubsanspruch-Prüfung"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        absence_type_id = data.get('absence_type_id')
        
        # Basis-Datumsprüfung
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                'end_date': 'Enddatum muss nach dem Startdatum liegen.'
            })
        
        # AbsenceType Validierung
        if absence_type_id:
            try:
                absence_type = AbsenceType.objects.get(id=absence_type_id)
                data['absence_type'] = absence_type
                
                # Urlaubsanspruch-Prüfung für Urlaubsanträge
                if absence_type.name == 'vacation' and start_date and end_date:
                    user = self.context['request'].user
                    
                    # Erstelle temporäres Absence-Objekt für Workday-Berechnung
                    temp_absence = Absence(
                        start_date=start_date,
                        end_date=end_date,
                        absence_type=absence_type,
                        user=user
                    )
                    
                    workdays = temp_absence.get_workday_count()
                    if not user.can_take_vacation(workdays, start_date.year):
                        remaining = user.get_remaining_vacation_days(start_date.year)
                        raise serializers.ValidationError({
                            'non_field_errors': [
                                f'Nicht genügend Urlaubstage verfügbar. '
                                f'Benötigt: {workdays} Arbeitstage, Verfügbar: {remaining} Tage'
                            ]
                        })
                        
            except AbsenceType.DoesNotExist:
                raise serializers.ValidationError({
                    'absence_type_id': 'Ungültiger Abwesenheitstyp.'
                })
        
        return data


class AbsenceCreateSerializer(AbsenceSerializer):
    """Spezieller Serializer für die Erstellung von Abwesenheiten"""
    
    class Meta(AbsenceSerializer.Meta):
        fields = [
            'absence_type_id', 'start_date', 'end_date', 'reason',
            'representative_id', 'certificate', 'additional_documents'
        ]
        read_only_fields = []


class AbsenceApprovalSerializer(serializers.ModelSerializer):
    """Serializer für Genehmigung/Ablehnung von Abwesenheiten"""
    action = serializers.ChoiceField(choices=['approve', 'reject'], write_only=True)
    comment = serializers.CharField(required=False, allow_blank=True, write_only=True)
    reason = serializers.CharField(required=False, allow_blank=True, write_only=True)
    
    class Meta:
        model = Absence
        fields = ['id', 'action', 'comment', 'reason', 'status']
        read_only_fields = ['id', 'status']

    def validate(self, data):
        action = data.get('action')
        
        if action == 'reject' and not data.get('reason'):
            raise serializers.ValidationError({
                'reason': 'Bei Ablehnung ist eine Begründung erforderlich.'
            })
        
        return data


class AbsenceHRSerializer(serializers.ModelSerializer):
    """Spezieller Serializer für HR-Funktionen"""
    user = UserMiniSerializer(read_only=True)
    absence_type = AbsenceTypeSerializer(read_only=True)
    approved_by = UserMiniSerializer(read_only=True)
    representative = UserMiniSerializer(read_only=True)
    
    class Meta:
        model = Absence
        fields = [
            'id', 'user', 'absence_type', 'start_date', 'end_date', 'reason',
            'status', 'approved_by', 'approved_at', 'approval_comment',
            'representative', 'hr_notified', 'hr_notified_at', 'hr_comment',
            'certificate', 'additional_documents', 'duration_days',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'absence_type', 'start_date', 'end_date', 'reason',
            'status', 'approved_by', 'approved_at', 'approval_comment',
            'representative', 'certificate', 'additional_documents',
            'duration_days', 'created_at', 'updated_at'
        ]
