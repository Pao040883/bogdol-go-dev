"""
API Serializers für Profile, Chat, Presence etc.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .profile_models import (
    Company, Department, Team, UserProfile, UserPresence,
    DepartmentRole, DepartmentMember
)
from .chat_models import ChatConversation, ChatMessage, ChatTypingIndicator

User = get_user_model()


# ============================================================================
# COMPANY & DEPARTMENT SERIALIZERS
# ============================================================================

class CompanySerializer(serializers.ModelSerializer):
    """Serializer für Gesellschaften"""
    department_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Company
        fields = ['id', 'name', 'code', 'description', 'address', 'phone', 
                 'email', 'website', 'logo', 'is_active', 'created_at', 
                 'updated_at', 'department_count', 'member_count']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_department_count(self, obj):
        return obj.departments.filter(is_active=True).count()
    
    def get_member_count(self, obj):
        # Count unique users across all departments of this company
        from django.db.models import Count
        return DepartmentMember.objects.filter(
            department__company=obj,
            is_active=True
        ).values('user').distinct().count()


class DepartmentRoleSerializer(serializers.ModelSerializer):
    """Serializer für Organisationsrollen"""
    member_count = serializers.SerializerMethodField()
    
    class Meta:
        model = DepartmentRole
        fields = ['id', 'name', 'code', 'hierarchy_level', 'org_type', 
                 'description', 'color', 'member_count', 'is_active',
                 'can_receive_faktura_assignments']
    
    def get_member_count(self, obj):
        return obj.members.filter(is_active=True).count()


class DepartmentMemberSerializer(serializers.ModelSerializer):
    """Serializer für Abteilungsmitglieder"""
    user_data = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    company = serializers.IntegerField(source='department.company.id', read_only=True)
    company_name = serializers.CharField(source='department.company.name', read_only=True)
    role_data = DepartmentRoleSerializer(source='role', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    reports_to_data = serializers.SerializerMethodField()
    is_company_mismatch = serializers.SerializerMethodField()
    
    class Meta:
        model = DepartmentMember
        fields = ['id', 'user', 'user_data', 'department', 'department_name',
                 'company', 'company_name',
                 'role', 'role_data', 'role_name', 'position_title', 'reports_to', 'reports_to_data',
                 'display_order', 'start_date', 'end_date', 'is_primary', 'is_staff_position', 'is_active', 'is_company_mismatch']
    
    def get_user_data(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'full_name': obj.user.get_full_name(),
            'email': obj.user.email,
            'avatar': obj.user.profile.avatar.url if hasattr(obj.user, 'profile') and obj.user.profile.avatar else None
        }
    
    def get_reports_to_data(self, obj):
        if obj.reports_to:
            return {
                'id': obj.reports_to.id,
                'user_full_name': obj.reports_to.user.get_full_name(),
                'role_name': obj.reports_to.role.name
            }
        return None
    
    def get_is_company_mismatch(self, obj):
        """Prüft ob die Department-Company in den User-Companies ist"""
        if not obj.department.company:
            return False
        user_companies = obj.user.profile.companies.all()
        return obj.department.company not in user_companies


class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer für Abteilungen"""
    company_name = serializers.CharField(source='company.name', read_only=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    member_count = serializers.SerializerMethodField()
    full_path = serializers.CharField(source='get_full_path', read_only=True)
    org_type_display = serializers.CharField(source='get_org_type_display', read_only=True)
    
    class Meta:
        model = Department
        fields = ['id', 'company', 'company_name', 'name', 'code', 'description', 'org_type', 'org_type_display',
                 'parent', 'parent_name', 'member_count', 'full_path', 'is_active']
    
    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()


class TeamSerializer(serializers.ModelSerializer):
    """Serializer für Teams"""
    department_name = serializers.CharField(source='department.name', read_only=True)
    lead_name = serializers.CharField(source='lead.get_full_name', read_only=True)
    member_count = serializers.SerializerMethodField()
    members_data = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = ['id', 'name', 'department', 'department_name', 'lead', 'lead_name',
                 'description', 'member_count', 'members', 'members_data', 'is_active']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_members_data(self, obj):
        """Gibt detaillierte Member-Daten"""
        return [{
            'id': m.id,
            'username': m.username,
            'full_name': m.get_full_name(),
            'avatar': m.profile.avatar.url if m.profile.avatar else None
        } for m in obj.members.all()]


# ============================================================================
# USER PROFILE SERIALIZERS
# ============================================================================

class UserProfileDetailSerializer(serializers.ModelSerializer):
    """Vollständiger Profile-Serializer"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    
    company_names = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    supervisor_name = serializers.CharField(
        source='direct_supervisor.get_full_name', read_only=True
    )
    full_phone = serializers.CharField(source='get_full_phone', read_only=True)
    online_status = serializers.CharField(
        source='user.online_status', read_only=True
    )
    
    def get_company_names(self, obj):
        return [c.name for c in obj.companies.all()]
    
    def get_department_name(self, obj):
        """Get primary department full path"""
        primary_dept = obj.primary_department
        if primary_dept:
            return primary_dept.get_full_path()
        return None
    
    class Meta:
        model = UserProfile
        fields = [
            # User-Basics
            'username', 'email', 'first_name', 'last_name', 'is_active',
            # Profil
            'display_name', 'avatar', 'bio',
            # Kontakt
            'phone_number', 'mobile_number', 'work_extension', 'email_backup',
            'preferred_contact_method', 'full_phone',
            # Organisation
            'companies', 'company_names', 'department_name', 'job_title', 'employee_id',
            'direct_supervisor', 'supervisor_name', 'functional_supervisors',
            # Skills & Verantwortung
            'responsibilities', 'expertise_areas',
            # Standort
            'office_location', 'desk_number', 'work_hours', 'timezone',
            # Vertrag
            'start_date', 'contract_type',
            # Urlaub
            'vacation_entitlement', 'carryover_vacation', 'vacation_year',
            # Notfall
            'emergency_contact_name', 'emergency_contact_phone',
            'emergency_contact_relation',
            # Integrationen
            'blink_id', 'blink_company', 'teams_id', 'slack_id',
            # E2E Encryption
            'public_key', 'public_key_updated_at',
            # Status
            'is_searchable', 'show_phone_in_directory', 'show_email_in_directory',
            'online_status',
        ]


class UserProfileListSerializer(serializers.ModelSerializer):
    """Vereinfachter Serializer für Listen"""
    id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='get_display_name', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    department_name = serializers.SerializerMethodField()
    online_status = serializers.CharField(
        source='user.online_status', read_only=True
    )
    public_key = serializers.CharField(read_only=True)
    
    def get_department_name(self, obj):
        """Get primary department name"""
        primary_dept = obj.primary_department
        if primary_dept:
            return primary_dept.name
        return None
    
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 
                 'avatar', 'job_title', 'department_name', 
                 'office_location', 'online_status', 'public_key',
                 'responsibilities', 'expertise_areas']


# ============================================================================
# PRESENCE SERIALIZER
# ============================================================================

class UserPresenceSerializer(serializers.ModelSerializer):
    """Serializer für Online-Status"""
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = UserPresence
        fields = ['username', 'full_name', 'status', 'status_message',
                 'is_available_for_chat', 'last_seen']


# ============================================================================
# CHAT SERIALIZERS
# ============================================================================

class ChatParticipantSerializer(serializers.ModelSerializer):
    """Mini-Serializer für Chat-Teilnehmer"""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    avatar = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'avatar', 'online_status', 'is_active']
    
    def get_avatar(self, obj):
        if hasattr(obj, 'profile') and obj.profile.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile.avatar.url)
            return obj.profile.avatar.url
        return None


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer für Chat-Nachrichten"""
    sender_data = ChatParticipantSerializer(source='sender', read_only=True)
    read_by_count = serializers.SerializerMethodField()
    reply_preview = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'conversation', 'sender', 'sender_data', 'message_type',
                 'content', 'metadata', 'file', 'file_name', 'thumbnail', 'reply_to',
                 'reply_preview', 'reactions', 'read_by', 'read_by_count',
                 'is_edited', 'is_deleted', 'is_encrypted', 'sent_at']
        read_only_fields = ['sent_at', 'edited_at', 'deleted_at']
    
    def get_read_by_count(self, obj):
        return obj.read_by.count()
    
    def get_reply_preview(self, obj):
        if obj.reply_to:
            return {
                'id': obj.reply_to.id,
                'sender': obj.reply_to.sender.username,
                'content': obj.reply_to.content[:100] if obj.reply_to.content else '[Datei]'
            }
        return None


class ChatConversationListSerializer(serializers.ModelSerializer):
    """Serializer für Chat-Konversationsliste"""
    participants_data = ChatParticipantSerializer(
        source='participants', many=True, read_only=True
    )
    last_message_preview = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = ['id', 'conversation_type', 'name', 'participants', 
                 'participants_data', 'last_message_preview', 'unread_count', 
                 'last_message_at', 'is_archived']
    
    def create(self, validated_data):
        """Custom create: ManyToMany-Felder manuell setzen"""
        participants_ids = validated_data.pop('participants', [])
        admins = validated_data.pop('admins', [])
        
        conversation = ChatConversation.objects.create(**validated_data)
        
        # WICHTIG: Participants als IDs setzen
        if participants_ids:
            conversation.participants.set(participants_ids)
        if admins:
            conversation.admins.set(admins)
        
        return conversation
    
    def get_last_message_preview(self, obj):
        last_msg = obj.messages.filter(is_deleted=False).order_by('-sent_at').first()
        if last_msg:
            # For encrypted messages, don't truncate (would break JSON)
            # Frontend will decrypt and truncate
            content = last_msg.content if last_msg.content else '[Datei]'
            
            # Only truncate if it's NOT encrypted (doesn't start with {)
            if content and not content.startswith('{'):
                content = content[:100]
            
            return {
                'sender': last_msg.sender.username,
                'content': content,
                'sent_at': last_msg.sent_at
            }
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.get_unread_count(request.user)
        return 0


class ChatConversationDetailSerializer(serializers.ModelSerializer):
    """Vollständiger Serializer für Chat-Details"""
    participants_data = ChatParticipantSerializer(
        source='participants', many=True, read_only=True
    )
    messages = ChatMessageSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = ChatConversation
        fields = ['id', 'conversation_type', 'name', 'description', 'avatar',
                 'participants', 'participants_data', 'admins', 'created_by',
                 'created_by_name', 'messages', 'last_message_at', 'is_archived']
    
    def create(self, validated_data):
        """Custom create: ManyToMany-Felder manuell setzen"""
        participants = validated_data.pop('participants', [])
        admins = validated_data.pop('admins', [])
        
        conversation = ChatConversation.objects.create(**validated_data)
        
        if participants:
            conversation.participants.set(participants)
        if admins:
            conversation.admins.set(admins)
        
        return conversation
