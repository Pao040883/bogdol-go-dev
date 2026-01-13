# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.admin.exceptions import NotRegistered
from .models import CustomUser
from .profile_models import (
    Company, Department, Team, UserProfile, UserPresence,
    DepartmentRole, DepartmentMember, Specialty, MemberSpecialty,
    WorkorderAssignment, SubstituteAssignment, HRAssignment
)
from .permission_models import PermissionCode, PermissionMapping
from .chat_models import ChatConversation, ChatMessage, ChatTypingIndicator

# Import Search Admin
from .search_admin import SearchQueryAdmin, SearchClickAdmin, SearchSynonymAdmin


# ============================================================================
# COMPANY ADMIN
# ============================================================================

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Admin für Gesellschaften"""
    list_display = ('name', 'code', 'department_count', 'member_count', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'code', 'description', 'address')
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('name', 'code', 'description')
        }),
        ('Kontaktdaten', {
            'fields': ('address', 'phone', 'email', 'website')
        }),
        ('Branding', {
            'fields': ('logo',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    
    def department_count(self, obj):
        """Anzahl der Abteilungen"""
        return obj.departments.filter(is_active=True).count()
    department_count.short_description = 'Abteilungen'
    
    def member_count(self, obj):
        """Anzahl der Mitarbeiter"""
        from django.db.models import Count
        return DepartmentMember.objects.filter(
            department__company=obj,
            is_active=True
        ).values('user').distinct().count()
    member_count.short_description = 'Mitarbeiter'


# ============================================================================
# CUSTOM USER ADMIN
# ============================================================================

class CustomUserAdmin(UserAdmin):
    """Admin für CustomUser (nur Auth-Felder)"""
    model = CustomUser
    
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 
                   'is_active', 'get_primary_department', 'get_status')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    
    def get_primary_department(self, obj):
        """Zeigt primäre Abteilung aus Profile"""
        if hasattr(obj, 'profile') and obj.profile:
            dept = obj.profile.primary_department
            return dept.name if dept else '-'
        return '-'
    get_primary_department.short_description = 'Abteilung'
    get_primary_department.admin_order_field = 'profile__user__department_memberships__department__name'
    
    def get_status(self, obj):
        """Zeigt Online-Status"""
        if hasattr(obj, 'presence'):
            status = obj.presence.get_status_display()
            return f"🟢 {status}" if obj.is_online else f"⚫ {status}"
        return '-'
    get_status.short_description = 'Status'


# ============================================================================
# DEPARTMENT ADMIN
# ============================================================================

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin für Abteilungen (Hierarchie)"""
    list_display = ('name', 'code', 'org_type', 'parent', 'member_count', 'is_active')
    list_filter = ('is_active', 'org_type', 'parent')
    search_fields = ('name', 'code', 'description', 'search_keywords')
    
    fieldsets = (
        ('Gesellschaft', {
            'fields': ('company',)
        }),
        ('Grunddaten', {
            'fields': ('name', 'code', 'org_type', 'description')
        }),
        ('Hierarchie', {
            'fields': ('parent', 'is_staff_department')
        }),
        ('KI-Suche Keywords', {
            'fields': ('search_keywords',),
            'description': 'Freitext-Keywords für semantische Suche (z.B. "Computer, Handy, IT-Support, Hardware")',
            'classes': ('wide',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def member_count(self, obj):
        """Anzahl der Mitarbeiter"""
        return obj.memberships.filter(is_active=True).count()
    member_count.short_description = 'Mitarbeiter'


# ============================================================================
# TEAM ADMIN
# ============================================================================

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    """Admin für Teams"""
    list_display = ('name', 'department', 'lead', 'member_count', 'is_active')
    list_filter = ('is_active', 'department')
    search_fields = ('name', 'department__name', 'description')
    filter_horizontal = ('members',)
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('name', 'department', 'description')
        }),
        ('Führung', {
            'fields': ('lead',)
        }),
        ('Mitglieder', {
            'fields': ('members',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def member_count(self, obj):
        """Anzahl der Mitarbeiter"""
        return obj.members.count()
    member_count.short_description = 'Mitarbeiter'


# ============================================================================
# USER PROFILE ADMIN (INLINE)
# ============================================================================

class UserProfileInline(admin.TabularInline):
    """Inline-Admin für UserProfile (im User-Detail)"""
    model = UserProfile
    extra = 0
    fields = ('department', 'job_title', 'phone_number', 'mobile_number', 
             'office_location', 'start_date')
    

# Registriere UserProfile auch standalone
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin für User-Profile"""
    list_display = ('get_full_name', 'get_primary_department', 'job_title', 
                   'office_location', 'is_searchable')
    list_filter = ('office_location', 'is_searchable', 'start_date')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 
                    'job_title', 'responsibilities')
    
    fieldsets = (
        ('Benutzer', {
            'fields': ('user',)
        }),
        ('Persönliches', {
            'fields': ('display_name', 'avatar', 'bio')
        }),
        ('Kontakt', {
            'fields': ('phone_number', 'mobile_number', 'work_extension', 
                      'email_backup', 'preferred_contact_method')
        }),
        ('Organisation', {
            'fields': ('companies', 'job_title', 'employee_id', 
                      'direct_supervisor', 'functional_supervisors'),
            'classes': ('wide',),
            'description': 'Abteilungszuordnungen werden über Department Members verwaltet'
        }),
        ('Zuständigkeiten & Skills (für KI-Suche)', {
            'fields': ('responsibilities', 'expertise_areas', 'embedding_vector', 'embedding_updated_at'),
            'description': 'Hier können Freitexte eingegeben werden, die der KI-Suche helfen, den richtigen Ansprechpartner zu finden. Z.B. "IT-Support, Hardware-Reparatur" oder "Buchhaltung, Rechnungsstellung"',
            'classes': ('wide',)
        }),
        ('Standort & Arbeitszeit', {
            'fields': ('office_location', 'desk_number', 'work_hours', 'timezone')
        }),
        ('Verträge & Urlaub', {
            'fields': ('start_date', 'contract_type', 'vacation_entitlement', 
                      'carryover_vacation', 'vacation_year')
        }),
        ('Notfallkontakt', {
            'fields': ('emergency_contact_name', 'emergency_contact_phone', 
                      'emergency_contact_relation'),
            'classes': ('collapse',)
        }),
        ('Integration', {
            'fields': ('blink_id', 'blink_company', 'teams_id', 'slack_id'),
            'classes': ('collapse',)
        }),
        ('Sichtbarkeit', {
            'fields': ('is_searchable', 'show_phone_in_directory', 
                      'show_email_in_directory')
        }),
        ('Interne Notizen', {
            'fields': ('internal_notes',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('embedding_vector', 'embedding_updated_at')
    
    def get_full_name(self, obj):
        return obj.get_display_name()
    get_full_name.short_description = 'Name'
    get_full_name.admin_order_field = 'user__last_name'
    
    def get_primary_department(self, obj):
        dept = obj.primary_department
        return dept.get_full_path() if dept else '-'
    get_primary_department.short_description = 'Primäre Abteilung'
    get_primary_department.admin_order_field = 'user__department_memberships__department__name'


# ============================================================================
# USER PRESENCE ADMIN
# ============================================================================

@admin.register(UserPresence)
class UserPresenceAdmin(admin.ModelAdmin):
    """Admin für Online-Status"""
    list_display = ('get_full_name', 'status', 'status_message', 
                   'is_available_for_chat', 'last_seen')
    list_filter = ('status', 'is_available_for_chat')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('last_seen', 'updated_at', 'websocket_channel_name')
    
    fieldsets = (
        ('Benutzer', {
            'fields': ('user',)
        }),
        ('Status', {
            'fields': ('status', 'status_message', 'is_available_for_chat')
        }),
        ('Realtime Info', {
            'fields': ('websocket_channel_name', 'last_seen', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Benutzer'
    get_full_name.admin_order_field = 'user__last_name'


# ============================================================================
# CHAT ADMIN
# ============================================================================

class ChatMessageInline(admin.TabularInline):
    """Inline-Messages für Konversation"""
    model = ChatMessage
    extra = 0
    fields = ('sender', 'message_type', 'content', 'sent_at')
    readonly_fields = ('sender', 'content', 'sent_at')
    can_delete = False
    

@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    """Admin für Chat-Konversationen"""
    list_display = ('get_title', 'conversation_type', 'message_count', 
                   'last_message_at', 'is_archived')
    list_filter = ('conversation_type', 'is_archived')
    search_fields = ('name', 'participants__username')
    filter_horizontal = ('participants', 'admins')
    inlines = [ChatMessageInline]
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('conversation_type', 'is_archived')
        }),
        ('Teilnehmer', {
            'fields': ('participants', 'admins')
        }),
        ('Gruppenchat', {
            'fields': ('name', 'description', 'avatar', 'created_by'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('last_message_at', 'created_at', 'updated_at'),
            'classes': ('collapse',),
            'description': 'Readonly - automatisch aktualisiert'
        }),
    )
    
    readonly_fields = ('last_message_at', 'created_at', 'updated_at')
    
    def get_title(self, obj):
        if obj.conversation_type == 'group':
            return f"📋 {obj.name or f'#{obj.id}'}"
        else:
            parts = [u.username for u in obj.participants.all()[:2]]
            return f"💬 {' & '.join(parts)}"
    get_title.short_description = 'Konversation'
    
    def message_count(self, obj):
        return obj.messages.count()
    message_count.short_description = 'Nachrichten'


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    """Admin für Chat-Nachrichten"""
    list_display = ('get_preview', 'sender', 'message_type', 'conversation', 
                   'sent_at', 'is_deleted')
    list_filter = ('message_type', 'is_deleted', 'conversation')
    search_fields = ('content', 'sender__username', 'conversation__name')
    readonly_fields = ('sent_at', 'created_at', 'updated_at', 'edited_at', 
                      'deleted_at', 'read_by')
    
    fieldsets = (
        ('Nachricht', {
            'fields': ('conversation', 'sender', 'message_type', 'content', 'reply_to')
        }),
        ('Datei', {
            'fields': ('file', 'file_name', 'file_size', 'file_type', 'thumbnail'),
            'classes': ('collapse',)
        }),
        ('Lesestatus', {
            'fields': ('read_by',),
            'classes': ('collapse',)
        }),
        ('Bearbeitung', {
            'fields': ('is_edited', 'edited_at', 'is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
        ('Reaktionen', {
            'fields': ('reactions',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('sent_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_preview(self, obj):
        if obj.is_deleted:
            return "🗑️ [Gelöscht]"
        preview = obj.content[:50] if obj.content else f"[{obj.get_message_type_display()}]"
        return preview
    get_preview.short_description = 'Nachricht'


# ============================================================================
# DEPARTMENT ROLE ADMIN
# ============================================================================

@admin.register(DepartmentRole)
class DepartmentRoleAdmin(admin.ModelAdmin):
    """Admin für Organisationsrollen"""
    list_display = ('name', 'code', 'hierarchy_level', 'org_type', 'can_receive_faktura_assignments', 'is_active')
    list_filter = ('org_type', 'hierarchy_level', 'can_receive_faktura_assignments', 'is_active')
    search_fields = ('name', 'code', 'description', 'search_keywords')
    ordering = ('hierarchy_level', 'name')
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('name', 'code', 'description')
        }),
        ('Hierarchie & Typ', {
            'fields': ('hierarchy_level', 'org_type')
        }),
        ('Zuweisungen', {
            'fields': ('can_receive_faktura_assignments',),
            'description': 'Definiert, ob Mitarbeiter mit dieser Rolle von Faktura-Mitarbeitern zugewiesen werden können (z.B. Service Manager)',
        }),
        ('KI-Suche Keywords', {
            'fields': ('search_keywords',),
            'description': 'Freitext-Keywords für semantische Suche (z.B. "Geschäftsführung, Leitung, Vorstand")',
            'classes': ('wide',)
        }),
        ('Darstellung', {
            'fields': ('color',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


# ============================================================================
# DEPARTMENT MEMBER ADMIN
# ============================================================================

class MemberSpecialtyInline(admin.TabularInline):
    """Inline für Fachbereichs-Zuordnungen"""
    model = MemberSpecialty
    extra = 1
    fields = ('specialty', 'proficiency_level', 'is_primary', 'is_active')
    autocomplete_fields = ['specialty']


class DepartmentMemberInline(admin.TabularInline):
    """Inline für Abteilungsmitglieder"""
    model = DepartmentMember
    extra = 0
    fields = ('user', 'role', 'position_title', 'reports_to', 'is_primary', 'is_active')
    autocomplete_fields = ['user', 'reports_to']


@admin.register(DepartmentMember)
class DepartmentMemberAdmin(admin.ModelAdmin):
    """Admin für Abteilungszuordnungen"""
    list_display = ('get_user', 'department', 'role', 'get_specialties', 'position_title', 'is_staff_position', 'is_primary', 'is_active')
    list_filter = ('is_active', 'is_primary', 'is_staff_position', 'department', 'role')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 
                    'department__name', 'position_title')
    autocomplete_fields = ['user', 'reports_to']
    inlines = [MemberSpecialtyInline]  # NEU: Inline für Fachbereiche
    
    fieldsets = (
        ('Zuordnung', {
            'fields': ('user', 'department', 'role')
        }),
        ('Position', {
            'fields': ('position_title', 'reports_to', 'display_order', 'is_staff_position')
        }),
        ('Zeitraum', {
            'fields': ('start_date', 'end_date')
        }),
        ('Status', {
            'fields': ('is_primary', 'is_active')
        }),
    )
    
    def get_user(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_user.short_description = 'Mitarbeiter'
    get_user.admin_order_field = 'user__last_name'
    
    def get_specialties(self, obj):
        """Zeigt alle Fachbereiche"""
        specialties = obj.specialty_assignments.filter(is_active=True).select_related('specialty')
        if not specialties:
            return '-'
        return ', '.join([
            f"{s.specialty.name}{'*' if s.is_primary else ''}" 
            for s in specialties
        ])
    get_specialties.short_description = 'Fachbereiche'


# ============================================================================
# SPECIALTY ADMIN
# ============================================================================

@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    """Admin für Fachbereiche"""
    list_display = ('name', 'code', 'department', 'parent', 'display_order', 'is_active')
    list_filter = ('department', 'is_active')
    search_fields = ('name', 'code', 'search_keywords', 'department__name')
    ordering = ('department', 'display_order', 'name')
    autocomplete_fields = ['department', 'parent']
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('department', 'name', 'code', 'description')
        }),
        ('Hierarchie', {
            'fields': ('parent', 'display_order')
        }),
        ('KI-Suche', {
            'fields': ('search_keywords',),
            'description': 'Keywords für bessere Auffindbarkeit (z.B. "Rechnungsstellung, Fakturierung, Abrechnung")',
            'classes': ('wide',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


# ============================================================================
# MEMBER SPECIALTY ADMIN
# ============================================================================

@admin.register(MemberSpecialty)
class MemberSpecialtyAdmin(admin.ModelAdmin):
    """Admin für Fachbereichs-Zuordnungen"""
    list_display = ('id', 'get_user', 'get_department', 'member', 'specialty', 'proficiency_level', 'is_primary', 'is_active')
    list_filter = ('is_active', 'is_primary', 'proficiency_level', 'specialty__department', 'member')
    search_fields = ('member__user__username', 'member__user__first_name', 'member__user__last_name', 'specialty__name', 'member__id')
    autocomplete_fields = ['member', 'specialty']
    
    fieldsets = (
        ('Zuordnung', {
            'fields': ('member', 'specialty')
        }),
        ('Details', {
            'fields': ('proficiency_level', 'is_primary')
        }),
        ('Zeitraum', {
            'fields': ('start_date', 'end_date')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def get_user(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.username
    get_user.short_description = 'Mitarbeiter'
    
    def get_department(self, obj):
        return obj.member.department.name
    get_department.short_description = 'Abteilung'


# ============================================================================
# WORKORDER ASSIGNMENT ADMIN
# ============================================================================

@admin.register(WorkorderAssignment)
class WorkorderAssignmentAdmin(admin.ModelAdmin):
    """Admin für Arbeitsschein-Zuordnungen"""
    list_display = ('get_submitter', 'get_processor', 'specialty', 'is_auto_assigned', 'is_active')
    list_filter = ('is_active', 'is_auto_assigned', 'specialty__department')
    search_fields = ('submitter__username', 'submitter__first_name', 'submitter__last_name',
                    'processor__username', 'processor__first_name', 'processor__last_name')
    autocomplete_fields = ['submitter', 'processor', 'specialty']
    
    fieldsets = (
        ('Zuordnung', {
            'fields': ('submitter', 'processor', 'specialty')
        }),
        ('Details', {
            'fields': ('is_auto_assigned',)
        }),
        ('Gültigkeit', {
            'fields': ('valid_from', 'valid_until')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def get_submitter(self, obj):
        return obj.submitter.get_full_name() or obj.submitter.username
    get_submitter.short_description = 'Einreicher'
    
    def get_processor(self, obj):
        return obj.processor.get_full_name() or obj.processor.username
    get_processor.short_description = 'Bearbeiter'


# ============================================================================
# SUBSTITUTE ASSIGNMENT ADMIN
# ============================================================================

@admin.register(SubstituteAssignment)
class SubstituteAssignmentAdmin(admin.ModelAdmin):
    """Admin für Vertretungs-Zuordnungen"""
    list_display = ('get_original', 'get_substitute', 'get_absence_dates', 'is_active')
    list_filter = ('is_active', 'absence__status')
    search_fields = ('original_user__username', 'original_user__first_name', 'original_user__last_name',
                    'substitute_user__username', 'substitute_user__first_name', 'substitute_user__last_name')
    autocomplete_fields = ['original_user', 'substitute_user', 'absence']
    filter_horizontal = ['specialties']
    
    fieldsets = (
        ('Vertretung', {
            'fields': ('original_user', 'substitute_user', 'absence')
        }),
        ('Fachbereiche', {
            'fields': ('specialties',),
            'description': 'Leer = alle Fachbereiche des abwesenden Users'
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def get_original(self, obj):
        return obj.original_user.get_full_name() or obj.original_user.username
    get_original.short_description = 'Abwesend'
    
    def get_substitute(self, obj):
        return obj.substitute_user.get_full_name() or obj.substitute_user.username
    get_substitute.short_description = 'Vertretung'
    
    def get_absence_dates(self, obj):
        return f"{obj.absence.start_date} - {obj.absence.end_date}"
    get_absence_dates.short_description = 'Zeitraum'


# ============================================================================
# HR ASSIGNMENT ADMIN
# ============================================================================

@admin.register(HRAssignment)
class HRAssignmentAdmin(admin.ModelAdmin):
    """Admin für HR-Zuordnungen"""
    list_display = ('get_employee', 'get_hr_processor', 'department', 'is_active', 'created_at')
    list_filter = ('is_active', 'department')
    search_fields = ('employee__username', 'employee__first_name', 'employee__last_name',
                    'hr_processor__username', 'hr_processor__first_name', 'hr_processor__last_name')
    autocomplete_fields = ['employee', 'hr_processor', 'department']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Zuordnung', {
            'fields': ('employee', 'hr_processor', 'department')
        }),
        ('Gültigkeit', {
            'fields': ('valid_from', 'valid_until'),
            'description': 'Optional: Zeitraum für die Zuweisung'
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def get_employee(self, obj):
        return obj.employee.get_full_name() or obj.employee.username
    get_employee.short_description = 'Mitarbeiter'
    
    def get_hr_processor(self, obj):
        return obj.hr_processor.get_full_name() or obj.hr_processor.username
    get_hr_processor.short_description = 'HR-Mitarbeiter'


# ============================================================================
# PERMISSION CODE ADMIN
# ============================================================================

@admin.register(PermissionCode)
class PermissionCodeAdmin(admin.ModelAdmin):
    """Admin für Permission Codes"""
    list_display = ('code', 'name', 'category', 'display_order', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('code', 'name', 'description')
    ordering = ('category', 'display_order', 'code')
    
    fieldsets = (
        ('Permission Details', {
            'fields': ('code', 'name', 'description', 'category')
        }),
        ('Anzeige', {
            'fields': ('display_order', 'is_active')
        }),
        ('Zeitstempel', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    
    def get_readonly_fields(self, request, obj=None):
        """Code ist nicht änderbar nach Erstellung"""
        if obj:  # Editing existing
            return self.readonly_fields + ('code',)
        return self.readonly_fields


# ============================================================================
# PERMISSION MAPPING ADMIN
# ============================================================================

@admin.register(PermissionMapping)
class PermissionMappingAdmin(admin.ModelAdmin):
    """Admin für Permission Mappings"""
    list_display = ('id', 'entity_type', 'get_entity_name', 'permission', 'object_type', 'is_active', 'created_at')
    list_filter = ('entity_type', 'is_active', 'permission__category', 'created_at')
    search_fields = ('permission__code', 'permission__name', 'entity_id')
    ordering = ('entity_type', 'entity_id', 'permission__category')
    
    autocomplete_fields = ['permission', 'created_by']
    
    fieldsets = (
        ('Mapping', {
            'fields': ('entity_type', 'entity_id', 'permission')
        }),
        ('Optional: Objektspezifisch', {
            'fields': ('object_type', 'object_id'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    
    def get_entity_name(self, obj):
        """Zeigt den Namen der Entity (Department/Role/Specialty/Group)"""
        return obj.get_entity_display_name()
    get_entity_name.short_description = 'Entity Name'


# ============================================================================
# REGISTRIERUNG
# ============================================================================
# admin.site.register(Department, DepartmentAdmin)
# admin.site.register(Team, TeamAdmin)
# admin.site.register(UserProfile, UserProfileAdmin)
# admin.site.register(UserPresence, UserPresenceAdmin)
# admin.site.register(ChatConversation, ChatConversationAdmin)
# admin.site.register(ChatMessage, ChatMessageAdmin)

# Re-register CustomUser mit neuem Admin
try:
    admin.site.unregister(CustomUser)
except NotRegistered:
    pass
admin.site.register(CustomUser, CustomUserAdmin)
