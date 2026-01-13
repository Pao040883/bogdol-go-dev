"""
Celery Tasks für Embedding-Generierung und KI-Features
"""
import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from .profile_models import UserProfile
from .embedding_service import generate_profile_embedding

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================================
# EMBEDDING TASKS
# ============================================================================

@shared_task(name='auth_user.tasks.generate_profile_embedding_task')
def generate_profile_embedding_task(profile_id: int):
    """
    Generiert Embedding für ein Profil (asynchron)
    
    Args:
        profile_id: UserProfile ID
    """
    try:
        profile = UserProfile.objects.get(id=profile_id)
        
        # Generiere Embedding
        embedding = generate_profile_embedding(profile)
        
        if embedding:
            # Speichere Embedding
            import json
            profile.embedding_vector = json.dumps(embedding)
            profile.save(update_fields=['embedding_vector', 'embedding_updated_at'])
            logger.info(f"✅ Embedding generiert für Profil {profile_id}")
            return True
        else:
            logger.warning(f"⚠️  Embedding-Generierung fehlgeschlagen für {profile_id}")
            return False
    
    except UserProfile.DoesNotExist:
        logger.error(f"❌ Profil {profile_id} nicht gefunden")
        return False
    except Exception as e:
        logger.error(f"❌ Fehler beim Embedding: {e}")
        return False


@shared_task(name='auth_user.tasks.regenerate_all_embeddings_task')
def regenerate_all_embeddings_task():
    """
    Regeneriert Embeddings für alle searchable Profile
    (z.B. tägliche Batch-Job)
    """
    profiles = UserProfile.objects.filter(
        is_searchable=True,
        user__is_active=True
    )
    
    count = 0
    for profile in profiles:
        generate_profile_embedding_task.delay(profile.user_id)
        count += 1
    
    logger.info(f"✅ {count} Embedding-Tasks in Queue eingeplant")
    return {'scheduled': count}


@shared_task(name='auth_user.tasks.update_embeddings_for_department')
def update_embeddings_for_department(department_id: int):
    """
    Aktualisiert Embeddings für alle User in einer Abteilung
    
    Args:
        department_id: Department ID
    """
    from .profile_models import Department
    
    try:
        department = Department.objects.get(id=department_id)
        members = department.members.all()
        
        count = 0
        for user in members:
            if hasattr(user, 'profile'):
                generate_profile_embedding_task.delay(user.profile.id)
                count += 1
        
        logger.info(f"✅ {count} Embeddings-Tasks für Dept {department.name} eingeplant")
        return {'department': department.name, 'count': count}
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Update: {e}")
        return False


# ============================================================================
# KI / SEMANTIC SEARCH TASKS
# ============================================================================

@shared_task(name='auth_user.tasks.semantic_search_profiles')
def semantic_search_profiles_task(query: str, top_k: int = 5):
    """
    Führt semantische Suche durch und cachet Ergebnisse
    
    Args:
        query: Such-Query
        top_k: Anzahl der Ergebnisse
        
    Returns:
        List von Profil-IDs
    """
    from .embedding_service import search_profiles_semantic
    
    try:
        results = search_profiles_semantic(query, top_k)
        
        if results:
            profile_ids = list(results.values_list('id', flat=True))
            logger.info(f"✅ Semantische Suche: {len(profile_ids)} Ergebnisse für '{query}'")
            return profile_ids
        else:
            logger.warning(f"⚠️  Keine Ergebnisse für '{query}'")
            return []
    
    except Exception as e:
        logger.error(f"❌ Semantische Suche Fehler: {e}")
        return []


# ============================================================================
# UTILITY TASKS
# ============================================================================

@shared_task(name='auth_user.tasks.health_check_embeddings')
def health_check_embeddings():
    """
    Health Check für Embedding-Service
    Wird regelmäßig aufgerufen um Service zu monitoren
    """
    from .embedding_service import get_embedding_manager
    
    manager = get_embedding_manager()
    available = manager.is_available()
    
    if available:
        logger.info("✅ Embedding-Service OK")
        
        # Zähle Profiles mit Embeddings
        count_with_embeddings = UserProfile.objects.filter(
            embedding_vector__isnull=False
        ).count()
        
        total_profiles = UserProfile.objects.filter(
            is_searchable=True
        ).count()
        
        coverage = (count_with_embeddings / total_profiles * 100) if total_profiles > 0 else 0
        
        return {
            'status': 'ok',
            'embeddings': count_with_embeddings,
            'total': total_profiles,
            'coverage_percent': round(coverage, 2)
        }
    else:
        logger.warning("⚠️  Embedding-Service nicht verfügbar")
        return {'status': 'unavailable'}
