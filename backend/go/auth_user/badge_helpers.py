"""
Badge Helper Functions für Realtime Updates über Django Channels
"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)


def send_badge_update(user_id: int, badges: dict):
    """
    Sendet Badge-Update über WebSocket an einen User
    
    Args:
        user_id: ID des Users
        badges: Dictionary mit Badge-Counts, z.B.:
                {
                    'chat': 5,
                    'arbeitsscheine': 2,
                    'organigramm': 1,
                    'sofortmeldungen': 0,
                    'absences': 3,
                    'users': 0
                }
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("❌ Channel Layer nicht verfügbar")
        return
    
    group_name = f'notifications_{user_id}'
    
    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'badge_update',
                'badges': badges
            }
        )
        logger.info(f"✅ Badge-Update gesendet an User {user_id}: {badges}")
    except Exception as e:
        logger.error(f"❌ Fehler beim Senden von Badge-Update: {e}")


def get_user_badge_counts(user):
    """
    Berechnet alle Badge-Counts für einen User
    
    Args:
        user: CustomUser Instanz
        
    Returns:
        Dictionary mit allen Badge-Counts
    """
    from django.db.models import Count, Q
    from auth_user.chat_models import ChatConversation, ChatMessage
    from workorders.models import WorkOrder
    from sofortmeldung.models import Sofortmeldung
    from absences.models import Absence
    from auth_user.permission_service import PermissionService
    
    badges = {
        'chat': 0,
        'arbeitsscheine': 0,
        'sofortmeldungen': 0,
        'absences': 0,
    }
    
    try:
        # Chat: Anzahl Konversationen mit ungelesenen Nachrichten (nicht versteckt, nicht archiviert)
        conversations = ChatConversation.objects.filter(
            participants=user,
            is_archived=False
        )
        
        unread_conversations = 0
        for conv in conversations:
            # Prüfe ob Konversation für User versteckt ist
            is_hidden = conv.hidden_for_users.filter(user=user).exists()
            if is_hidden:
                continue
                
            has_unread = ChatMessage.objects.filter(
                conversation=conv,
                is_deleted=False
            ).exclude(
                read_by=user
            ).exclude(
                sender=user
            ).exists()
            
            if has_unread:
                unread_conversations += 1
        
        badges['chat'] = unread_conversations
        
        # Arbeitsscheine: Eingereichte WorkOrder (status='submitted')
        # WICHTIG: Nutze die gleiche Business-Logic wie in scope_filters.py
        from auth_user.scope_filters import ScopeQuerySetMixin
        
        perm_service = PermissionService.for_user(user)
        
        if perm_service.has_permission('can_view_workorders'):
            # Basis: Alle eingereichten Arbeitsscheine
            submitted_qs = WorkOrder.objects.filter(status='submitted')
            
            # Filtere mit der gleichen Scope + Business-Logic wie in der WorkOrder-Liste
            filtered_qs = ScopeQuerySetMixin.filter_workorders_by_scope(
                submitted_qs,
                user,
                perm_service
            )
            
            badges['arbeitsscheine'] = filtered_qs.count()
        
        # Sofortmeldungen: Ungelesene Sofortmeldungen
        try:
            badges['sofortmeldungen'] = Sofortmeldung.objects.filter(
                empfaenger=user,
                gelesen=False
            ).count()
        except Exception:
            badges['sofortmeldungen'] = 0
        
        # Absences: Pending Urlaubsanträge (für Vorgesetzte)
        try:
            badges['absences'] = Absence.objects.filter(
                approver=user,
                status='pending'
            ).count()
        except Exception:
            badges['absences'] = 0
            
    except Exception as e:
        logger.error(f"❌ Fehler beim Berechnen von Badge-Counts: {e}")
        import traceback
        traceback.print_exc()
    
    return badges
