from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Sofortmeldung
from .tasks import process_sofortmeldung, check_sofortmeldung_status

@admin.register(Sofortmeldung)
class SofortmeldungAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'full_name', 'start_date', 'status_badge', 
        'tan', 'createdAt', 'createdBy', 'actions_column'
    ]
    list_filter = ['status', 'start_date', 'createdAt', 'group']
    search_fields = [
        'first_name', 'last_name', 'insurance_number', 
        'tan', 'createdBy__username'
    ]
    readonly_fields = ['createdAt', 'createdBy', 'tan', 'url']
    date_hierarchy = 'start_date'
    ordering = ['-createdAt']
    
    fieldsets = (
        ('Personal Information', {
            'fields': (
                'first_name', 'last_name', 'birth_name',
                'birth_date', 'birth_place', 'birth_land', 'birth_gender'
            )
        }),
        ('Employment Information', {
            'fields': (
                'companyNumber', 'insurance_number', 'group', 
                'start_date', 'citizenship'
            )
        }),
        ('Address Information', {
            'fields': (
                'country_code', 'city_name', 'zip_code', 'street_name'
            )
        }),
        ('System Information', {
            'fields': (
                'status', 'tan', 'url', 'createdAt', 'createdBy'
            )
        }),
    )
    
    def full_name(self, obj):
        """Zeigt den vollständigen Namen an"""
        return f"{obj.first_name} {obj.last_name}"
    full_name.short_description = "Name"
    
    def status_badge(self, obj):
        """Zeigt einen farbigen Status-Badge an"""
        if obj.status and obj.tan:
            color = "green"
            text = "Erfolgreich"
            icon = "✓"
        elif not obj.status and obj.tan:
            color = "red"
            text = "Fehlgeschlagen"
            icon = "✗"
        elif not obj.status and not obj.tan:
            color = "orange"
            text = "Ausstehend"
            icon = "⏳"
        else:
            color = "gray"
            text = "Unbekannt"
            icon = "?"
            
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color, icon, text
        )
    status_badge.short_description = "Status"
    
    def actions_column(self, obj):
        """Zeigt Aktions-Buttons an"""
        buttons = []
        
        # Resend Button
        if not obj.status or not obj.tan:
            resend_url = reverse('admin:sofortmeldung_resend', args=[obj.pk])
            buttons.append(
                f'<a href="#" onclick="resendSofortmeldung({obj.pk})" '
                f'style="background: #007cba; color: white; padding: 2px 8px; '
                f'text-decoration: none; border-radius: 3px; font-size: 11px;">Erneut senden</a>'
            )
        
        # Status Check Button
        if obj.tan:
            buttons.append(
                f'<a href="#" onclick="checkStatus({obj.pk})" '
                f'style="background: #28a745; color: white; padding: 2px 8px; '
                f'text-decoration: none; border-radius: 3px; font-size: 11px;">Status prüfen</a>'
            )
        
        # PDF Link
        if obj.url:
            buttons.append(
                f'<a href="{obj.url}" target="_blank" '
                f'style="background: #dc3545; color: white; padding: 2px 8px; '
                f'text-decoration: none; border-radius: 3px; font-size: 11px;">PDF öffnen</a>'
            )
        
        return mark_safe(' '.join(buttons)) if buttons else "-"
    actions_column.short_description = "Aktionen"
    
    def get_queryset(self, request):
        """Optimiert die Datenbankabfrage"""
        return super().get_queryset(request).select_related('createdBy')
    
    def save_model(self, request, obj, form, change):
        """Setzt den Ersteller bei neuen Objekten"""
        if not change:  # Nur bei neuen Objekten
            obj.createdBy = request.user
        super().save_model(request, obj, form, change)
    
    def get_readonly_fields(self, request, obj=None):
        """Macht bestimmte Felder bei Updates readonly"""
        readonly_fields = list(self.readonly_fields)
        if obj:  # Beim Bearbeiten existierender Objekte
            readonly_fields.extend(['companyNumber', 'insurance_number'])
        return readonly_fields
    
    class Media:
        js = ('admin/js/sofortmeldung_admin.js',)
        css = {
            'all': ('admin/css/sofortmeldung_admin.css',)
        }
