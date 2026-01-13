from django.contrib import admin
from .models import (
    WorkOrderClient, WorkObject, WorkOrder, WorkOrderTemplate,
    RecurringWorkOrderChecklist
)
from .history_models import WorkOrderHistory


@admin.register(WorkOrderClient)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'phone', 'email', 'is_active', 'created_at']
    list_filter = ['is_active', 'city']
    search_fields = ['name', 'city', 'email']
    ordering = ['name']


@admin.register(WorkObject)
class WorkObjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'client', 'city', 'contact_person', 'is_active', 'created_at']
    list_filter = ['client', 'is_active', 'city']
    search_fields = ['name', 'client__name', 'city', 'contact_person']
    ordering = ['client__name', 'name']
    autocomplete_fields = ['client']


@admin.register(WorkOrderTemplate)
class WorkOrderTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'client', 'work_type', 'work_days', 'is_active', 'created_at']
    list_filter = ['is_active', 'client']
    search_fields = ['name', 'client__name', 'work_type']
    ordering = ['client__name', 'name']
    autocomplete_fields = ['client', 'work_object']
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Kunde & Objekt', {
            'fields': ('client', 'work_object')
        }),
        ('Arbeitsdetails', {
            'fields': (
                'work_type', 'work_description',
                'work_days', 'work_schedule'
            )
        }),
        ('Bemerkungen', {
            'fields': ('customer_notes', 'internal_notes'),
            'classes': ('collapse',)
        }),
    )


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_number', 'object_number', 'project_number', 'client', 'work_type', 'start_date', 
        'status', 'is_duplicate', 'pdf_downloaded', 'submitted_at', 'reviewed_at', 
        'template', 'assigned_to', 'created_at'
    ]
    list_filter = [
        'status', 'is_duplicate', 'pdf_downloaded', 'start_date', 
        'client', 'template', 'submitted_at'
    ]
    search_fields = [
        'order_number', 'project_number', 'object_number', 
        'client__name', 'work_type'
    ]
    ordering = ['-created_at']
    autocomplete_fields = [
        'client', 'work_object', 'template', 'assigned_to', 
        'created_by', 'submitted_by', 'reviewed_by',
        'duplicate_of', 'pdf_downloaded_by'
    ]
    readonly_fields = [
        'order_number', 'created_at', 'updated_at', 'completed_at', 
        'customer_signed_at', 'submitted_at', 'reviewed_at',
        'duplicate_checked_at', 'pdf_downloaded_at'
    ]
    
    fieldsets = (
        ('Grunddaten', {
            'fields': (
                'order_number', 'object_number', 'project_number', 
                'status', 'template'
            )
        }),
        ('Kunde & Objekt', {
            'fields': ('client', 'work_object')
        }),
        ('Arbeitsdetails', {
            'fields': (
                'work_type', 'work_description',
                'start_date', 'end_date', 'month', 'work_days', 'work_schedule'
            )
        }),
        ('Zuweisung', {
            'fields': ('assigned_to', 'created_by')
        }),
        ('Duplikat-Erkennung', {
            'fields': (
                'is_duplicate', 'duplicate_of', 'duplicate_checked_at'
            ),
        }),
        ('Download-Tracking', {
            'fields': (
                'pdf_downloaded', 'pdf_downloaded_at', 'pdf_downloaded_by'
            ),
        }),
        ('Billing Workflow', {
            'fields': (
                'submitted_at', 'submitted_by', 
                'reviewed_at', 'reviewed_by', 
                'scanned_document'
            )
        }),
        ('Unterschriften', {
            'fields': (
                'customer_signature', 'customer_signed_at',
                'company_signature'
            ),
            'classes': ('collapse',)
        }),
        ('Bemerkungen', {
            'fields': ('customer_notes', 'internal_notes'),
            'classes': ('collapse',)
        }),
        ('Zeitstempel', {
            'fields': ('created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(WorkOrderHistory)
class WorkOrderHistoryAdmin(admin.ModelAdmin):
    list_display = ['work_order', 'action', 'performed_by', 'performed_at', 'old_status', 'new_status']
    list_filter = ['action', 'performed_at']
    search_fields = ['work_order__order_number', 'performed_by__username', 'notes']
    ordering = ['-performed_at']
    readonly_fields = ['work_order', 'action', 'performed_by', 'performed_at', 'old_status', 'new_status', 'notes', 'metadata']
    
    def has_add_permission(self, request):
        # History sollte nur automatisch erstellt werden
        return False
    
    def has_delete_permission(self, request, obj=None):
        # History sollte nicht gelöscht werden können
        return False


@admin.register(RecurringWorkOrderChecklist)
class RecurringWorkOrderChecklistAdmin(admin.ModelAdmin):
    list_display = [
        'object_number', 'project_number', 'object_description',
        'debitor_number', 'sr_invoice_number', 'service_manager', 'assigned_billing_user',
        'current_month', 'checked_this_month', 'last_checked_at', 'is_active'
    ]
    list_filter = ['checked_this_month', 'is_active', 'current_month', 'sr_invoice_number', 'service_manager', 'assigned_billing_user']
    search_fields = ['object_number', 'project_number', 'object_description', 'debitor_number', 'notes', 'sr_invoice_number']
    ordering = ['object_number', 'project_number']
    autocomplete_fields = ['client', 'work_object', 'created_by', 'last_checked_by', 'service_manager', 'assigned_billing_user']
    readonly_fields = ['current_month', 'created_at', 'updated_at', 'last_checked_at']
    
    fieldsets = (
        ('Stammdaten', {
            'fields': (
                'object_number', 'object_description', 
                'project_number', 'debitor_number'
            )
        }),
        ('Kunde & Objekt', {
            'fields': ('client', 'work_object'),
            'classes': ('collapse',)
        }),
        ('Zuständigkeiten', {
            'fields': ('service_manager', 'assigned_billing_user'),
            'description': 'Service Manager und zugewiesener Faktur-Mitarbeiter'
        }),
        ('SR-Rechnung & Bemerkungen', {
            'fields': ('sr_invoice_number', 'notes'),
            'description': 'SR-Nummer für Sammelrechnungen und freie Notizen'
        }),
        ('Monatliches Tracking', {
            'fields': (
                'current_month', 'checked_this_month',
                'last_checked_at', 'last_checked_by'
            ),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('is_active', 'valid_from', 'valid_until', 'created_at', 'created_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['reset_monthly_checks', 'mark_checked']
    
    def reset_monthly_checks(self, request, queryset):
        """Setzt monatliche Checks für ausgewählte Einträge zurück"""
        for item in queryset:
            item.reset_monthly_check()
        self.message_user(request, f'{queryset.count()} Einträge zurückgesetzt')
    reset_monthly_checks.short_description = 'Monatliche Checks zurücksetzen'
    
    def mark_checked(self, request, queryset):
        """Markiert ausgewählte Einträge als abgehakt"""
        for item in queryset:
            item.check_for_month(request.user)
        self.message_user(request, f'{queryset.count()} Einträge abgehakt')
    mark_checked.short_description = 'Als abgehakt markieren'

