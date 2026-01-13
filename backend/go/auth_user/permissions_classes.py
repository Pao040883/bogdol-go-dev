"""
Permission Classes für auth_user App
"""
from rest_framework import permissions


class IsHRPermission(permissions.BasePermission):
    """
    Permission zum Verwalten von HR-Assignments
    Nur HR-Mitarbeiter oder Admins
    """
    
    def has_permission(self, request, view):
        # Admins/Superuser haben immer Zugriff
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        # User muss in HR-Gruppe sein
        return request.user.groups.filter(name='HR').exists()
    
    def has_object_permission(self, request, view, obj):
        # Admins/Superuser haben immer Zugriff
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        # HR-Mitarbeiter haben Zugriff
        if request.user.groups.filter(name='HR').exists():
            return True
        
        # OPTIONAL: Employee kann eigene Zuweisungen sehen (aber nicht ändern)
        if view.action in ['retrieve', 'list'] and obj.employee == request.user:
            return True
        
        return False
