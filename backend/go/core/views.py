from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.cache import cache
from django.db import connection
from django.conf import settings
from django.utils import timezone
import redis
import logging

logger = logging.getLogger(__name__)

@require_http_methods(["GET"])
def health_check(request):
    """
    Health Check Endpoint für Docker & Load Balancer
    """
    health_status = {
        'status': 'healthy',
        'service': 'bogdol-go-backend',
        'version': '1.0.0',
        'timestamp': timezone.now().isoformat(),
        'checks': {
            'database': 'unknown',
            'redis': 'unknown',
            'celery': 'unknown'
        }
    }
    
    # Database Check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        health_status['checks']['database'] = 'ok'
    except Exception as e:
        health_status['checks']['database'] = {'status': 'error', 'message': str(e)}
        health_status['status'] = 'unhealthy'
    
    # Redis Check
    try:
        cache.set('health_check', 'ok', 30)
        if cache.get('health_check') == 'ok':
            health_status['checks']['redis'] = 'ok'
        else:
            raise Exception("Redis cache test failed")
    except Exception as e:
        health_status['checks']['redis'] = {'status': 'error', 'message': str(e)}
        health_status['status'] = 'unhealthy'
    
    # Celery Check (einfach)
    try:
        from celery import current_app
        stats = current_app.control.inspect().stats()
        if stats:
            worker_count = len(stats)
            health_status['checks']['celery'] = {'status': 'ok', 'workers': worker_count}
        else:
            health_status['checks']['celery'] = {'status': 'warning', 'message': 'no_workers'}
    except Exception as e:
        health_status['checks']['celery'] = {'status': 'error', 'message': str(e)}
    
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)

@require_http_methods(["GET"])
def api_info(request):
    """
    API Information Endpoint
    """
    from django.urls import reverse
    
    api_info = {
        'name': 'Bogdol GO API',
        'version': '1.0.0',
        'description': 'Enterprise Angular/Django Application for HR & Service Management',
        'endpoints': {
            'health': request.build_absolute_uri(reverse('health_check')),
            'admin': request.build_absolute_uri('/admin/'),
            'api_root': request.build_absolute_uri('/api/'),
        },
        'features': [
            'Absence Management System',
            'Blink API Integration',
            'User Authentication & Authorization',
            'Real-time Notifications',
            'Celery Background Tasks',
            'Redis Caching'
        ],
        'technology': {
            'backend': 'Django 5.2.4 + DRF',
            'frontend': 'Angular 20 + Ionic 7',
            'database': 'PostgreSQL',
            'cache': 'Redis',
            'task_queue': 'Celery',
            'web_server': 'Nginx'
        }
    }
    
    return JsonResponse(api_info)

@require_http_methods(["GET"])
def system_stats(request):
    """
    System Statistics für Monitoring
    """
    try:
        stats = {
            'timestamp': timezone.now().isoformat(),
            'database': {},
            'cache': {},
            'tasks': {}
        }
        
        # Database Stats
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_users 
                    FROM auth_user_customuser
                """)
                result = cursor.fetchone()
                stats['database']['total_users'] = result[0] if result else 0
                
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_absences 
                    FROM absences_absence
                """)
                result = cursor.fetchone()
                stats['database']['total_absences'] = result[0] if result else 0
                
        except Exception as e:
            stats['database']['error'] = str(e)
        
        # Cache Stats
        try:
            # Redis Info
            redis_client = cache._cache.get_client(1)
            redis_info = redis_client.info()
            stats['cache'] = {
                'used_memory_human': redis_info.get('used_memory_human'),
                'connected_clients': redis_info.get('connected_clients'),
                'total_commands_processed': redis_info.get('total_commands_processed')
            }
        except Exception as e:
            stats['cache']['error'] = str(e)
        
        # Celery Stats
        try:
            from celery import current_app
            inspect = current_app.control.inspect()
            active_tasks = inspect.active()
            scheduled_tasks = inspect.scheduled()
            
            stats['tasks'] = {
                'active_workers': len(active_tasks) if active_tasks else 0,
                'active_tasks': sum(len(tasks) for tasks in (active_tasks or {}).values()),
                'scheduled_tasks': sum(len(tasks) for tasks in (scheduled_tasks or {}).values())
            }
        except Exception as e:
            stats['tasks']['error'] = str(e)
        
        return JsonResponse(stats)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
