"""
Permission Mapping Models - Flexibles Berechtigungssystem
Ermöglicht Frontend-Konfiguration von Berechtigungen ohne Code-Änderungen
"""
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class PermissionCode(models.Model):
    """
    Zentrale Definition aller verfügbaren Permissions
    Frontend-Admin kann diese Permissions Entities zuweisen
    
    Scope-Levels:
    - OWN: Nur eigene Objekte (z.B. eigene Arbeitsscheine)
    - DEPARTMENT: Objekte der eigenen Abteilung
    - ALL: Alle Objekte im System
    - NONE: Keine Scope-Einschränkung (z.B. für App-Zugriff)
    """
    
    SCOPE_CHOICES = [
        ('NONE', 'Keine Einschränkung'),
        ('OWN', 'Nur eigene'),
        ('DEPARTMENT', 'Eigene Abteilung'),
        ('ALL', 'Alle'),
    ]
    
    code = models.CharField(
        'Permission Code',
        max_length=100,
        unique=True,
        help_text='Eindeutiger Code, z.B. can_view_workorders'
    )
    name = models.CharField(
        'Name',
        max_length=200,
        help_text='Anzeigename für Frontend'
    )
    description = models.TextField(
        'Beschreibung',
        blank=True,
        help_text='Was erlaubt diese Permission?'
    )
    category = models.CharField(
        'Kategorie',
        max_length=50,
        choices=[
            ('APP', 'Apps & Features'),
            ('ADMIN', 'Administration'),
            ('WORKORDER', 'Arbeitsscheine'),
            ('ABSENCE', 'Abwesenheiten'),
            ('USER', 'Benutzerverwaltung'),
            ('DEPARTMENT', 'Abteilungsverwaltung'),
            ('ANALYTICS', 'Auswertungen'),
            ('OTHER', 'Sonstige')
        ],
        default='OTHER'
    )
    default_scope = models.CharField(
        'Standard-Scope',
        max_length=20,
        choices=SCOPE_CHOICES,
        default='NONE',
        help_text='Standard-Geltungsbereich dieser Permission (kann pro Mapping überschrieben werden)'
    )
    supports_scope = models.BooleanField(
        'Unterstützt Scope',
        default=False,
        help_text='Kann diese Permission unterschiedliche Scopes haben? (z.B. eigene vs. alle Arbeitsscheine)'
    )
    is_active = models.BooleanField(
        'Aktiv',
        default=True
    )
    display_order = models.IntegerField(
        'Anzeigereihenfolge',
        default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Permission Code'
        verbose_name_plural = 'Permission Codes'
        ordering = ['category', 'display_order', 'code']
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class PermissionMapping(models.Model):
    """
    Flexible Zuordnung: Entity (Department/Role/Specialty) → Permission
    Ermöglicht Frontend-Konfiguration ohne Code-Änderungen
    """
    ENTITY_TYPE_CHOICES = [
        ('DEPARTMENT', 'Abteilung'),
        ('ROLE', 'Rolle'),
        ('SPECIALTY', 'Fachbereich'),
        ('GROUP', 'Django Group')
    ]
    
    # Was bekommt die Berechtigung?
    entity_type = models.CharField(
        'Entity-Typ',
        max_length=20,
        choices=ENTITY_TYPE_CHOICES
    )
    entity_id = models.IntegerField(
        'Entity ID',
        help_text='ID der Department/Role/Specialty/Group'
    )
    
    # Welche Berechtigung?
    permission = models.ForeignKey(
        PermissionCode,
        on_delete=models.CASCADE,
        related_name='mappings',
        verbose_name='Permission'
    )
    
    # Geltungsbereich (überschreibt default_scope der Permission)
    scope = models.CharField(
        'Geltungsbereich',
        max_length=20,
        choices=PermissionCode.SCOPE_CHOICES,
        null=True,
        blank=True,
        help_text='Überschreibt den Standard-Scope. Leer = nutze default_scope der Permission'
    )
    
    # Optional: Objektspezifische Permission
    object_type = models.CharField(
        'Objekt-Typ',
        max_length=50,
        blank=True,
        help_text='Optional: z.B. "workorder", "absence" für objektspezifische Rechte'
    )
    object_id = models.IntegerField(
        'Objekt-ID',
        null=True,
        blank=True,
        help_text='Optional: ID des spezifischen Objekts'
    )
    
    # Meta
    is_active = models.BooleanField(
        'Aktiv',
        default=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_permission_mappings',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Permission Mapping'
        verbose_name_plural = 'Permission Mappings'
        unique_together = [
            ['entity_type', 'entity_id', 'permission', 'object_type', 'object_id']
        ]
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['permission', 'is_active']),
        ]
    
    def __str__(self):
        obj_info = f" [{self.object_type}:{self.object_id}]" if self.object_type else ""
        scope_info = f" (Scope: {self.get_effective_scope()})" if self.scope or self.permission.supports_scope else ""
        return f"{self.get_entity_type_display()} {self.entity_id} → {self.permission.code}{obj_info}{scope_info}"
    
    def get_effective_scope(self):
        """Gibt den effektiven Scope zurück (mapping.scope oder permission.default_scope)"""
        return self.scope if self.scope else self.permission.default_scope
    
    def clean(self):
        """Validierung"""
        if self.object_id and not self.object_type:
            raise ValidationError('object_id requires object_type to be set')
        
        # Validiere Scope nur wenn Permission Scope unterstützt
        if self.scope and not self.permission.supports_scope:
            raise ValidationError(
                f'Permission "{self.permission.code}" unterstützt keine Scope-Einschränkungen'
            )
    
    def get_entity_display_name(self):
        """Gibt den Anzeigenamen der Entity zurück"""
        from .profile_models import Department, DepartmentRole, Specialty
        from django.contrib.auth.models import Group
        
        try:
            if self.entity_type == 'DEPARTMENT':
                return Department.objects.get(id=self.entity_id).name
            elif self.entity_type == 'ROLE':
                return DepartmentRole.objects.get(id=self.entity_id).name
            elif self.entity_type == 'SPECIALTY':
                return Specialty.objects.get(id=self.entity_id).name
            elif self.entity_type == 'GROUP':
                return Group.objects.get(id=self.entity_id).name
        except:
            return f"ID {self.entity_id}"
        
        return "Unknown"
