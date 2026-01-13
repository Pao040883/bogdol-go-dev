from django.contrib import admin
from django.utils.html import format_html
from .models import Absence, AbsenceType, AbsenceConflict


@admin.register(AbsenceType)
class AbsenceTypeAdmin(admin.ModelAdmin):
    list_display = (
        'display_name', 'name', 'requires_approval', 'requires_certificate', 
        'advance_notice_days', 'max_consecutive_days', 'color_preview', 'is_active'
    )
    list_filter = ('requires_approval', 'requires_certificate', 'is_active')
    search_fields = ('display_name', 'name', 'description')
    ordering = ('display_name',)
    
    fieldsets = (
        ('Grundinformationen', {
            'fields': ('name', 'display_name', 'description', 'is_active')
        }),
        ('Eigenschaften', {
            'fields': ('requires_approval', 'requires_certificate', 'advance_notice_days', 'max_consecutive_days', 'deduct_from_vacation')
        }),
        ('Darstellung', {
            'fields': ('color', 'icon')
        }),
    )
    
    def color_preview(self, obj):
        return format_html(
            '<div style="width: 20px; height: 20px; background-color: {}; border: 1px solid #ccc;"></div>',
            obj.color_code
        )
    color_preview.short_description = 'Farbe'


class AbsenceConflictInline(admin.TabularInline):
    model = AbsenceConflict
    fk_name = 'absence'  # Spezifiziert welches ForeignKey verwendet werden soll
    extra = 0
    readonly_fields = ('conflict_type', 'conflicting_absence', 'description', 'severity', 'created_at')
    fields = ('conflict_type', 'conflicting_absence', 'description', 'severity', 'resolved', 'resolution_comment')


@admin.register(Absence)
class AbsenceAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'absence_type', 'start_date', 'end_date', 'duration_days',
        'status_badge', 'approved_by', 'representative', 'hr_notified'
    )
    list_filter = (
        'status', 'absence_type', 'hr_notified', 'representative_confirmed',
        'start_date', 'created_at'
    )
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'reason')
    readonly_fields = (
        'duration_days', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at',
        'hr_notified_at', 'representative_confirmed_at', 'created_at', 'updated_at'
    )
    ordering = ('-start_date',)
    date_hierarchy = 'start_date'
    
    fieldsets = (
        ('Grundinformationen', {
            'fields': ('user', 'absence_type', 'start_date', 'end_date', 'reason')
        }),
        ('Status', {
            'fields': ('status', 'duration_days')
        }),
        ('Genehmigung', {
            'fields': (
                'approved_by', 'approved_at', 'approval_comment',
                'rejected_by', 'rejected_at', 'rejection_reason'
            )
        }),
        ('Vertretung', {
            'fields': ('representative', 'representative_confirmed', 'representative_confirmed_at')
        }),
        ('HR Integration', {
            'fields': ('hr_notified', 'hr_notified_at', 'hr_comment')
        }),
        ('Dateien', {
            'fields': ('certificate', 'additional_documents')
        }),
        ('Zeitstempel', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [AbsenceConflictInline]
    
    def status_badge(self, obj):
        colors = {
            'pending': '#ffc107',      # Gelb
            'approved': '#28a745',     # Grün
            'rejected': '#dc3545',     # Rot
            'hr_notified': '#17a2b8',  # Blau
            'cancelled': '#6c757d',    # Grau
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">●</span> {}',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'user', 'absence_type', 'approved_by', 'rejected_by', 'representative'
        )
    
    actions = ['mark_as_approved', 'mark_as_rejected', 'notify_hr']
    
    def mark_as_approved(self, request, queryset):
        updated = 0
        for absence in queryset.filter(status=Absence.PENDING):
            absence.approve(approved_by=request.user)
            updated += 1
        self.message_user(request, f'{updated} Abwesenheiten wurden genehmigt.')
    mark_as_approved.short_description = 'Ausgewählte Abwesenheiten genehmigen'
    
    def mark_as_rejected(self, request, queryset):
        updated = 0
        for absence in queryset.filter(status=Absence.PENDING):
            absence.reject(rejected_by=request.user, reason='Massenablehnung durch Admin')
            updated += 1
        self.message_user(request, f'{updated} Abwesenheiten wurden abgelehnt.')
    mark_as_rejected.short_description = 'Ausgewählte Abwesenheiten ablehnen'
    
    def notify_hr(self, request, queryset):
        updated = 0
        for absence in queryset.filter(status=Absence.APPROVED, hr_notified=False):
            absence.notify_hr(comment='HR durch Admin benachrichtigt')
            updated += 1
        self.message_user(request, f'{updated} HR-Benachrichtigungen wurden versendet.')
    notify_hr.short_description = 'HR über ausgewählte Abwesenheiten benachrichtigen'


@admin.register(AbsenceConflict)
class AbsenceConflictAdmin(admin.ModelAdmin):
    list_display = (
        'absence', 'conflict_type_display', 'conflicting_absence',
        'severity_badge', 'resolved', 'created_at'
    )
    list_filter = ('conflict_type', 'severity', 'resolved', 'created_at')
    search_fields = ('absence__user__username', 'description')
    readonly_fields = ('created_at', 'resolved_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Konfliktinformationen', {
            'fields': ('absence', 'conflict_type', 'conflicting_absence', 'description', 'severity')
        }),
        ('Lösung', {
            'fields': ('resolved', 'resolution_comment', 'resolved_at')
        }),
        ('Zeitstempel', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def conflict_type_display(self, obj):
        return obj.get_conflict_type_display()
    conflict_type_display.short_description = 'Konflikttyp'
    
    def severity_badge(self, obj):
        colors = {
            'low': '#28a745',      # Grün
            'medium': '#ffc107',   # Gelb
            'high': '#dc3545',     # Rot
        }
        color = colors.get(obj.severity, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">●</span> {}',
            color, obj.get_severity_display()
        )
    severity_badge.short_description = 'Schweregrad'
    
    actions = ['mark_as_resolved']
    
    def mark_as_resolved(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(resolved=False).update(
            resolved=True,
            resolution_comment='Als gelöst markiert durch Admin',
            resolved_at=timezone.now()
        )
        self.message_user(request, f'{updated} Konflikte wurden als gelöst markiert.')
    mark_as_resolved.short_description = 'Als gelöst markieren'

