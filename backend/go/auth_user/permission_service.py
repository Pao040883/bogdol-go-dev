"""
Permission Service - Zentrale Berechtigungsprüfung
Prüft dynamisch gegen PermissionMapping statt Hardcoding
"""
from django.core.cache import cache
from .permission_models import PermissionMapping, PermissionCode
from .profile_models import MemberSpecialty


class PermissionService:
    """
    Zentrale Service-Klasse für Berechtigungsprüfung
    Prüft dynamisch gegen PermissionMapping
    """
    
    @staticmethod
    def for_user(user):
        """Factory-Methode für User-spezifische Permission-Instanz"""
        return UserPermissionService(user)
    
    @staticmethod
    def clear_cache(user_id):
        """Löscht Permission-Cache für User"""
        cache.delete(f'user_permissions_{user_id}')
    
    @staticmethod
    def clear_all_caches():
        """Löscht alle Permission-Caches"""
        cache.delete_pattern('user_permissions_*')


class UserPermissionService:
    """
    User-spezifische Permission-Prüfung
    """
    
    def __init__(self, user):
        self.user = user
        self._cache_key = f'user_permissions_{user.id}'
        self._permissions_cache = None
    
    def has_full_access(self):
        """Prüft ob User vollen Zugriff hat (Superuser/Staff)"""
        return self.user.is_superuser or self.user.is_staff
    
    def has_permission(self, permission_code, use_cache=True):
        """
        Prüft ob User eine Permission hat (irgendein Scope)
        
        Args:
            permission_code: Code der Permission (z.B. 'can_view_workorders')
            use_cache: Cache verwenden? (Default: True)
        
        Returns:
            bool: Hat Permission?
        """
        # Bypass für Superuser/Staff
        if self.has_full_access():
            return True
        
        # Cache prüfen
        if use_cache:
            cached = self._get_cached_permissions()
            if cached is not None:
                return permission_code in cached
        
        # Permission-Check durchführen
        has_perm = self._check_permission_mappings(permission_code)
        
        return has_perm
    
    def get_permission_scope(self, permission_code):
        """
        Gibt den effektiven Scope einer Permission zurück
        
        Args:
            permission_code: Code der Permission
        
        Returns:
            str: Scope ('NONE', 'OWN', 'DEPARTMENT', 'ALL') oder None wenn keine Permission
        """
        # Bypass für Superuser/Staff → immer ALL
        if self.has_full_access():
            return 'ALL'
        
        try:
            permission = PermissionCode.objects.get(code=permission_code, is_active=True)
        except PermissionCode.DoesNotExist:
            return None
        
        # Wenn Permission keine Scope-Unterstützung hat
        if not permission.supports_scope:
            return 'NONE' if self.has_permission(permission_code) else None
        
        # Sammle alle Scopes aus Mappings
        scopes = self._collect_permission_scopes(permission)
        
        if not scopes:
            return None
        
        # Höchster Scope gewinnt: ALL > DEPARTMENT > OWN > NONE
        scope_priority = {'ALL': 4, 'DEPARTMENT': 3, 'OWN': 2, 'NONE': 1}
        return max(scopes, key=lambda s: scope_priority.get(s, 0))
    
    def has_scope(self, permission_code, required_scope):
        """
        Prüft ob User eine Permission mit mindestens dem geforderten Scope hat
        
        Args:
            permission_code: Code der Permission
            required_scope: Geforderter Scope ('OWN', 'DEPARTMENT', 'ALL')
        
        Returns:
            bool: Hat Permission mit ausreichendem Scope?
        """
        current_scope = self.get_permission_scope(permission_code)
        if not current_scope:
            return False
        
        # NONE erfüllt keine Scope-Anforderungen
        if current_scope == 'NONE':
            return required_scope == 'NONE'
        
        # Scope-Hierarchie prüfen
        scope_priority = {'ALL': 4, 'DEPARTMENT': 3, 'OWN': 2, 'NONE': 1}
        return scope_priority.get(current_scope, 0) >= scope_priority.get(required_scope, 0)
    
    def get_all_permissions(self, use_cache=True):
        """
        Gibt alle Permissions des Users zurück
        
        Returns:
            set: Permission-Codes
        """
        if self.has_full_access():
            # Superuser/Staff haben alle
            return set(PermissionCode.objects.filter(
                is_active=True
            ).values_list('code', flat=True))
        
        # Cache prüfen
        if use_cache:
            cached = self._get_cached_permissions()
            if cached is not None:
                return cached
        
        # Alle Permissions sammeln
        permissions = self._collect_all_permissions()
        
        # Cache speichern (10 Minuten) - Convert to list for JSON serialization
        cache.set(self._cache_key, list(permissions), 600)
        
        return permissions
    
    def _get_cached_permissions(self):
        """Holt Permissions aus Cache"""
        return cache.get(self._cache_key)
    
    def _check_permission_mappings(self, permission_code):
        """
        Prüft PermissionMapping für User
        
        Prüft in dieser Reihenfolge:
        1. Department Permissions
        2. Role Permissions
        3. Specialty Permissions
        4. Group Permissions
        """
        try:
            permission = PermissionCode.objects.get(code=permission_code, is_active=True)
        except PermissionCode.DoesNotExist:
            return False
        
        # 1. Department Permissions
        user_departments = self.user.department_memberships.filter(
            is_active=True
        ).values_list('department_id', flat=True)
        
        if PermissionMapping.objects.filter(
            entity_type='DEPARTMENT',
            entity_id__in=user_departments,
            permission=permission,
            is_active=True
        ).exists():
            return True
        
        # 2. Role Permissions
        user_roles = self.user.department_memberships.filter(
            is_active=True
        ).values_list('role_id', flat=True)
        
        if PermissionMapping.objects.filter(
            entity_type='ROLE',
            entity_id__in=user_roles,
            permission=permission,
            is_active=True
        ).exists():
            return True
        
        # 3. Specialty Permissions
        user_specialties = MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            is_active=True
        ).values_list('specialty_id', flat=True)
        
        if PermissionMapping.objects.filter(
            entity_type='SPECIALTY',
            entity_id__in=user_specialties,
            permission=permission,
            is_active=True
        ).exists():
            return True
        
        # 4. Group Permissions
        user_groups = self.user.groups.values_list('id', flat=True)
        
        if PermissionMapping.objects.filter(
            entity_type='GROUP',
            entity_id__in=user_groups,
            permission=permission,
            is_active=True
        ).exists():
            return True
        
        return False
    
    def _collect_permission_scopes(self, permission):
        """
        Sammelt alle Scopes für eine Permission aus den Mappings des Users
        
        Args:
            permission: PermissionCode Objekt
        
        Returns:
            list: Liste der Scopes
        """
        scopes = []
        
        # Department Scopes
        user_departments = self.user.department_memberships.filter(
            is_active=True
        ).values_list('department_id', flat=True)
        
        dept_mappings = PermissionMapping.objects.filter(
            entity_type='DEPARTMENT',
            entity_id__in=user_departments,
            permission=permission,
            is_active=True
        )
        for mapping in dept_mappings:
            scopes.append(mapping.get_effective_scope())
        
        # Role Scopes
        user_roles = self.user.department_memberships.filter(
            is_active=True
        ).values_list('role_id', flat=True)
        
        role_mappings = PermissionMapping.objects.filter(
            entity_type='ROLE',
            entity_id__in=user_roles,
            permission=permission,
            is_active=True
        )
        for mapping in role_mappings:
            scopes.append(mapping.get_effective_scope())
        
        # Specialty Scopes
        user_specialties = MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            is_active=True
        ).values_list('specialty_id', flat=True)
        
        spec_mappings = PermissionMapping.objects.filter(
            entity_type='SPECIALTY',
            entity_id__in=user_specialties,
            permission=permission,
            is_active=True
        )
        for mapping in spec_mappings:
            scopes.append(mapping.get_effective_scope())
        
        # Group Scopes
        user_groups = self.user.groups.values_list('id', flat=True)
        
        group_mappings = PermissionMapping.objects.filter(
            entity_type='GROUP',
            entity_id__in=user_groups,
            permission=permission,
            is_active=True
        )
        for mapping in group_mappings:
            scopes.append(mapping.get_effective_scope())
        
        return scopes
    
    def _collect_all_permissions(self):
        """Sammelt alle Permissions des Users"""
        permissions = set()
        
        # Department Permissions
        user_departments = self.user.department_memberships.filter(
            is_active=True
        ).values_list('department_id', flat=True)
        
        dept_perms = PermissionMapping.objects.filter(
            entity_type='DEPARTMENT',
            entity_id__in=user_departments,
            is_active=True
        ).select_related('permission').values_list('permission__code', flat=True)
        permissions.update(dept_perms)
        
        # Role Permissions
        user_roles = self.user.department_memberships.filter(
            is_active=True
        ).values_list('role_id', flat=True)
        
        role_perms = PermissionMapping.objects.filter(
            entity_type='ROLE',
            entity_id__in=user_roles,
            is_active=True
        ).select_related('permission').values_list('permission__code', flat=True)
        permissions.update(role_perms)
        
        # Specialty Permissions
        user_specialties = MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            is_active=True
        ).values_list('specialty_id', flat=True)
        
        spec_perms = PermissionMapping.objects.filter(
            entity_type='SPECIALTY',
            entity_id__in=user_specialties,
            is_active=True
        ).select_related('permission').values_list('permission__code', flat=True)
        permissions.update(spec_perms)
        
        # Group Permissions
        user_groups = self.user.groups.values_list('id', flat=True)
        
        group_perms = PermissionMapping.objects.filter(
            entity_type='GROUP',
            entity_id__in=user_groups,
            is_active=True
        ).select_related('permission').values_list('permission__code', flat=True)
        permissions.update(group_perms)
        
        return permissions
    
    def has_specialty(self, specialty_code):
        """Prüft ob User einen Fachbereich hat"""
        return MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            specialty__code=specialty_code,
            is_active=True
        ).exists()
    
    def get_permissions_summary(self):
        """
        Gibt eine Zusammenfassung aller Permissions zurück
        
        Returns:
            dict: Permissions gruppiert nach Quelle
        """
        summary = {
            'all_permissions': self.get_all_permissions(),
            'by_source': {
                'department': set(),
                'role': set(),
                'specialty': set(),
                'group': set()
            }
        }
        
        # Nach Quelle gruppieren
        user_departments = list(self.user.department_memberships.filter(
            is_active=True
        ).values_list('department_id', flat=True))
        
        user_roles = list(self.user.department_memberships.filter(
            is_active=True
        ).values_list('role_id', flat=True))
        
        user_specialties = list(MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            is_active=True
        ).values_list('specialty_id', flat=True))
        
        user_groups = list(self.user.groups.values_list('id', flat=True))
        
        for mapping in PermissionMapping.objects.filter(
            is_active=True
        ).select_related('permission'):
            
            if mapping.entity_type == 'DEPARTMENT' and mapping.entity_id in user_departments:
                summary['by_source']['department'].add(mapping.permission.code)
            elif mapping.entity_type == 'ROLE' and mapping.entity_id in user_roles:
                summary['by_source']['role'].add(mapping.permission.code)
            elif mapping.entity_type == 'SPECIALTY' and mapping.entity_id in user_specialties:
                summary['by_source']['specialty'].add(mapping.permission.code)
            elif mapping.entity_type == 'GROUP' and mapping.entity_id in user_groups:
                summary['by_source']['group'].add(mapping.permission.code)
        
        return summary
    
    def get_permissions_with_sources(self):
        """
        Gibt alle Permissions mit ihren Quellen zurück
        
        Returns:
            dict: {permission_code: [{'type': 'ROLE', 'id': 1, 'name': '...', 'scope': '...'}]}
        """
        result = {}
        
        # User-Entities sammeln
        user_departments = list(self.user.department_memberships.filter(
            is_active=True
        ).select_related('department', 'role'))
        
        user_specialties = list(MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            is_active=True
        ).select_related('specialty'))
        
        user_groups = list(self.user.groups.all())
        
        # Department Mappings
        dept_ids = [m.department_id for m in user_departments]
        for mapping in PermissionMapping.objects.filter(
            entity_type='DEPARTMENT',
            entity_id__in=dept_ids,
            is_active=True
        ).select_related('permission'):
            code = mapping.permission.code
            dept = next((m.department for m in user_departments if m.department_id == mapping.entity_id), None)
            if dept:
                if code not in result:
                    result[code] = []
                result[code].append({
                    'type': 'DEPARTMENT',
                    'id': dept.id,
                    'name': dept.name,
                    'code': dept.code,
                    'scope': mapping.get_effective_scope(),
                    'mapping_id': mapping.id
                })
        
        # Role Mappings
        role_ids = [m.role_id for m in user_departments if m.role_id]
        for mapping in PermissionMapping.objects.filter(
            entity_type='ROLE',
            entity_id__in=role_ids,
            is_active=True
        ).select_related('permission'):
            code = mapping.permission.code
            role = next((m.role for m in user_departments if m.role_id == mapping.entity_id), None)
            if role:
                if code not in result:
                    result[code] = []
                result[code].append({
                    'type': 'ROLE',
                    'id': role.id,
                    'name': role.name,
                    'code': role.code,
                    'scope': mapping.get_effective_scope(),
                    'mapping_id': mapping.id
                })
        
        # Specialty Mappings
        spec_ids = [ms.specialty_id for ms in user_specialties]
        for mapping in PermissionMapping.objects.filter(
            entity_type='SPECIALTY',
            entity_id__in=spec_ids,
            is_active=True
        ).select_related('permission'):
            code = mapping.permission.code
            spec = next((ms.specialty for ms in user_specialties if ms.specialty_id == mapping.entity_id), None)
            if spec:
                if code not in result:
                    result[code] = []
                result[code].append({
                    'type': 'SPECIALTY',
                    'id': spec.id,
                    'name': spec.name,
                    'code': spec.code,
                    'scope': mapping.get_effective_scope(),
                    'mapping_id': mapping.id
                })
        
        # Group Mappings
        group_ids = [g.id for g in user_groups]
        for mapping in PermissionMapping.objects.filter(
            entity_type='GROUP',
            entity_id__in=group_ids,
            is_active=True
        ).select_related('permission'):
            code = mapping.permission.code
            group = next((g for g in user_groups if g.id == mapping.entity_id), None)
            if group:
                if code not in result:
                    result[code] = []
                result[code].append({
                    'type': 'GROUP',
                    'id': group.id,
                    'name': group.name,
                    'code': None,
                    'scope': mapping.get_effective_scope(),
                    'mapping_id': mapping.id
                })
        
        return result
    
    def get_mappings_for_user(self):
        """
        Gibt alle PermissionMappings des Users gruppiert nach Entity-Typ zurück
        
        Returns:
            dict: {
                'departments': [...],
                'roles': [...],
                'specialties': [...],
                'groups': [...]
            }
        """
        result = {
            'departments': [],
            'roles': [],
            'specialties': [],
            'groups': []
        }
        
        # User-Entities
        user_departments = self.user.department_memberships.filter(is_active=True)
        user_specialties = MemberSpecialty.objects.filter(
            member__user=self.user,
            member__is_active=True,
            is_active=True
        )
        user_groups = self.user.groups.all()
        
        # Department Mappings
        for membership in user_departments:
            dept_mappings = PermissionMapping.objects.filter(
                entity_type='DEPARTMENT',
                entity_id=membership.department_id,
                is_active=True
            ).select_related('permission')
            
            role_mappings = []
            if membership.role_id:
                role_mappings = PermissionMapping.objects.filter(
                    entity_type='ROLE',
                    entity_id=membership.role_id,
                    is_active=True
                ).select_related('permission')
            
            result['departments'].append({
                'department_obj': membership.department,
                'role_obj': membership.role,
                'is_primary': membership.is_primary,
                'permissions_from_department': [
                    {
                        'code': m.permission.code,
                        'name': m.permission.name,
                        'scope': m.get_effective_scope(),
                        'mapping_id': m.id
                    } for m in dept_mappings
                ],
                'permissions_from_role': [
                    {
                        'code': m.permission.code,
                        'name': m.permission.name,
                        'scope': m.get_effective_scope(),
                        'mapping_id': m.id
                    } for m in role_mappings
                ]
            })
        
        # Specialty Mappings
        for member_spec in user_specialties:
            spec_mappings = PermissionMapping.objects.filter(
                entity_type='SPECIALTY',
                entity_id=member_spec.specialty_id,
                is_active=True
            ).select_related('permission')
            
            result['specialties'].append({
                'specialty_obj': member_spec.specialty,
                'is_active': member_spec.is_active,
                'is_primary': member_spec.is_primary,
                'proficiency_level': member_spec.proficiency_level,
                'permissions_from_specialty': [
                    {
                        'code': m.permission.code,
                        'name': m.permission.name,
                        'scope': m.get_effective_scope(),
                        'mapping_id': m.id
                    } for m in spec_mappings
                ]
            })
        
        # Group Mappings
        for group in user_groups:
            group_mappings = PermissionMapping.objects.filter(
                entity_type='GROUP',
                entity_id=group.id,
                is_active=True
            ).select_related('permission')
            
            result['groups'].append({
                'group_obj': group,
                'permissions_from_group': [
                    {
                        'code': m.permission.code,
                        'name': m.permission.name,
                        'scope': m.get_effective_scope(),
                        'mapping_id': m.id
                    } for m in group_mappings
                ]
            })
        
        return result
    
    def get_detailed_summary(self):
        """
        Erweiterte Summary mit Category/Scope/Source-Breakdown
        
        Returns:
            dict: Detaillierte Statistiken
        """
        all_permissions = self.get_all_permissions(use_cache=False)
        permissions_with_sources = self.get_permissions_with_sources()
        
        # Permissions nach Category zählen
        by_category = {}
        by_scope = {'NONE': 0, 'OWN': 0, 'DEPARTMENT': 0, 'ALL': 0}
        by_source = {'DEPARTMENT': 0, 'ROLE': 0, 'SPECIALTY': 0, 'GROUP': 0}
        
        total_mappings = 0
        
        for perm_code in all_permissions:
            try:
                perm_obj = PermissionCode.objects.get(code=perm_code, is_active=True)
                
                # Category zählen
                category = perm_obj.category or 'OTHER'
                by_category[category] = by_category.get(category, 0) + 1
                
                # Scope ermitteln
                scope = self.get_permission_scope(perm_code)
                if scope:
                    by_scope[scope] = by_scope.get(scope, 0) + 1
                
                # Sources zählen
                if perm_code in permissions_with_sources:
                    sources = permissions_with_sources[perm_code]
                    total_mappings += len(sources)
                    for source in sources:
                        source_type = source['type']
                        by_source[source_type] = by_source.get(source_type, 0) + 1
            except PermissionCode.DoesNotExist:
                continue
        
        return {
            'total_permissions': len(all_permissions),
            'total_mappings': total_mappings,
            'has_full_access': self.has_full_access(),
            'permissions_by_category': by_category,
            'permissions_by_scope': by_scope,
            'permissions_by_source': by_source
        }
