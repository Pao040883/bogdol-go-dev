from django.contrib import admin
from .models import ContactProfile


@admin.register(ContactProfile)
class ContactProfileAdmin(admin.ModelAdmin):
    """Admin Interface für Contact Profiles"""
    
    list_display = [
        'get_full_name', 'get_department', 'get_job_title',
        'office_location', 'work_extension', 'is_visible_in_directory'
    ]
    list_filter = [
        'is_visible_in_directory', 'office_location',
        'preferred_contact_method'
    ]
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'user__email', 'office_location', 'desk_number'
    ]
    
    fieldsets = (
        ('Benutzer', {
            'fields': ('user',)
        }),
        ('Kontaktinformationen', {
            'fields': (
                'work_extension', 'private_phone',
                'preferred_contact_method'
            )
        }),
        ('Notfallkontakt', {
            'fields': (
                'emergency_contact_name',
                'emergency_contact_phone',
                'emergency_contact_relation'
            ),
            'classes': ('collapse',)
        }),
        ('Standort & Arbeitsplatz', {
            'fields': (
                'office_location', 'desk_number',
                'typical_work_hours', 'timezone'
            )
        }),
        ('Collaboration Tools', {
            'fields': ('teams_id', 'slack_id'),
            'classes': ('collapse',)
        }),
        ('Sonstiges', {
            'fields': ('notes', 'is_visible_in_directory')
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Name'
    get_full_name.admin_order_field = 'user__last_name'
    
    def get_department(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile:
            dept = obj.user.profile.primary_department
            return dept.name if dept else '-'
        return '-'
    get_department.short_description = 'Abteilung'
    
    def get_job_title(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.job_title:
            return obj.user.profile.job_title
        return '-'
    get_job_title.short_description = 'Position'
