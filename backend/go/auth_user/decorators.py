"""
Decorators für Permission-Checks in Views
"""
from functools import wraps
from rest_framework.exceptions import PermissionDenied
from .permissions import PermissionService


def require_specialty(specialty_code):
    """
    Decorator: Prüft Fachbereich-Zuordnung
    
    Usage:
        @require_specialty('FIN-FAK')
        def process_workorder(self, request, pk=None):
            # ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(view_instance, request, *args, **kwargs):
            perms = PermissionService.for_user(request.user)
            
            if not perms.has_specialty(specialty_code):
                raise PermissionDenied(f"Fachbereich '{specialty_code}' erforderlich")
            
            return view_func(view_instance, request, *args, **kwargs)
        return wrapper
    return decorator


def require_full_access(view_func):
    """
    Decorator: Prüft ob User GF/Superuser ist
    
    Usage:
        @require_full_access
        def admin_action(self, request, pk=None):
            # ...
    """
    @wraps(view_func)
    def wrapper(view_instance, request, *args, **kwargs):
        perms = PermissionService.for_user(request.user)
        
        if not perms.has_full_access():
            raise PermissionDenied("Nur für GF/Administratoren zugänglich")
        
        return view_func(view_instance, request, *args, **kwargs)
    return wrapper


def require_workorder_access(view_func):
    """
    Decorator: Prüft ob User Arbeitsschein bearbeiten darf
    
    Usage:
        @require_workorder_access
        def process(self, request, pk=None):
            workorder = self.get_object()
            # ...
    """
    @wraps(view_func)
    def wrapper(view_instance, request, *args, **kwargs):
        workorder = view_instance.get_object()
        perms = PermissionService.for_user(request.user)
        
        if not perms.can_process_workorder(workorder):
            raise PermissionDenied("Keine Berechtigung für diesen Arbeitsschein")
        
        return view_func(view_instance, request, *args, **kwargs)
    return wrapper
