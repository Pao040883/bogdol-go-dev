"""
Helper-Funktionen für Chat-Integration bei Abwesenheiten
"""
import logging
from django.contrib.auth import get_user_model
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from auth_user.chat_models import ChatConversation, ChatMessage

User = get_user_model()
logger = logging.getLogger(__name__)


def get_or_create_direct_conversation(user1, user2):
    """
    Findet eine existierende 1:1-Konversation oder erstellt eine neue
    
    Args:
        user1: Erster Benutzer
        user2: Zweiter Benutzer
        
    Returns:
        ChatConversation: Die Konversation zwischen den beiden Benutzern
    """
    # Suche nach existierender Direktkonversation
    existing = ChatConversation.objects.filter(
        conversation_type='direct',
        participants=user1
    ).filter(
        participants=user2
    ).first()
    
    if existing:
        logger.info(f"✅ Existierende Konversation gefunden: {existing.id}")
        return existing
    
    # Erstelle neue Konversation
    conversation = ChatConversation.objects.create(
        conversation_type='direct',
        created_by=user1
    )
    conversation.participants.add(user1, user2)
    logger.info(f"✨ Neue Konversation erstellt: {conversation.id} zwischen {user1.username} und {user2.username}")
    
    return conversation


def get_first_admin_or_hr():
    """
    Gibt den ersten verfügbaren Admin oder HR-Mitarbeiter zurück
    Fallback wenn User keinen Vorgesetzten hat
    
    Returns:
        User: Admin oder HR-User
    """
    # Versuche zuerst HR-Gruppe
    hr_user = User.objects.filter(groups__name='HR', is_active=True).first()
    if hr_user:
        return hr_user
    
    # Fallback auf Superuser
    admin = User.objects.filter(is_superuser=True, is_active=True).first()
    if admin:
        return admin
    
    # Letzter Fallback: Irgendein Staff-User
    staff = User.objects.filter(is_staff=True, is_active=True).first()
    return staff


def send_absence_request_message(conversation, absence, sender):
    """
    Sendet eine Chat-Nachricht für einen neuen Abwesenheitsantrag
    
    Args:
        conversation: ChatConversation Objekt
        absence: Absence Objekt
        sender: User der den Antrag stellt
    """
    # Nachricht-Content
    duration_text = f"{absence.duration_days} Tag" if absence.duration_days == 1 else f"{absence.duration_days} Tage"
    content = f"📅 Neuer Abwesenheitsantrag: {absence.absence_type.display_name}"
    
    # Metadata mit allen relevanten Daten
    metadata = {
        'absence_id': absence.id,
        'absence_type': absence.absence_type.display_name,
        'absence_type_id': absence.absence_type.id,
        'start_date': absence.start_date.isoformat(),
        'end_date': absence.end_date.isoformat(),
        'duration_days': absence.duration_days,
        'reason': absence.reason or '',
        'status': absence.status,
        'requires_approval': absence.absence_type.requires_approval
    }
    
    # Nachricht erstellen
    message = ChatMessage.objects.create(
        conversation=conversation,
        sender=sender,
        content=content,
        message_type='absence_request',
        metadata=metadata,
        is_encrypted=False  # Abwesenheitsanträge sind nicht E2E verschlüsselt
    )
    
    # WebSocket-Broadcast an alle Conversation-Teilnehmer
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'chat_{conversation.id}',
            {
                'type': 'chat_message',
                'message_id': message.id,
                'conversation_id': conversation.id,
                'sender': sender.username,
                'sender_name': sender.get_full_name(),
                'content': content,
                'message_type': 'absence_request',
                'metadata': metadata,
                'is_encrypted': False,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    logger.info(f"📨 Abwesenheitsantrag-Nachricht gesendet in Konversation {conversation.id}")
    return message


def send_absence_decision_message(conversation, absence, decision_maker, approved, rejection_reason=None):
    """
    Sendet eine Chat-Nachricht für eine Genehmigung/Ablehnung
    
    Args:
        conversation: ChatConversation Objekt
        absence: Absence Objekt
        decision_maker: User der die Entscheidung trifft
        approved: Boolean ob genehmigt
        rejection_reason: Optional Ablehnungsgrund
    """
    if approved:
        content = f"✅ Abwesenheitsantrag wurde genehmigt"
        icon = "✅"
    else:
        content = f"❌ Abwesenheitsantrag wurde abgelehnt"
        icon = "❌"
    
    metadata = {
        'absence_id': absence.id,
        'absence_type': absence.absence_type.display_name,
        'start_date': absence.start_date.isoformat(),
        'end_date': absence.end_date.isoformat(),
        'duration_days': absence.duration_days,
        'decision': 'approved' if approved else 'rejected',
        'decided_by': decision_maker.get_full_name(),
        'decided_by_id': decision_maker.id,
        'rejection_reason': rejection_reason or '',
        'status': absence.status
    }
    
    message = ChatMessage.objects.create(
        conversation=conversation,
        sender=decision_maker,
        content=content,
        message_type='absence_decision',
        metadata=metadata,
        is_encrypted=False
    )
    
    # WebSocket-Broadcast für Entscheidungsnachricht
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'chat_{conversation.id}',
            {
                'type': 'chat_message',
                'message_id': message.id,
                'conversation_id': conversation.id,
                'sender': decision_maker.username,
                'sender_name': decision_maker.get_full_name(),
                'content': content,
                'message_type': 'absence_decision',
                'metadata': metadata,
                'is_encrypted': False,
                'timestamp': timezone.now().isoformat()
            }
        )
        
        # Aktualisiere auch die ursprüngliche Antragsnachricht mit neuem Status
        try:
            original_message = ChatMessage.objects.filter(
                conversation=conversation,
                message_type='absence_request',
                metadata__absence_id=absence.id
            ).first()
            
            if original_message:
                # Update metadata mit neuem Status
                original_message.metadata['status'] = absence.status
                original_message.save(update_fields=['metadata'])
                
                # Broadcast Update für die ursprüngliche Nachricht
                async_to_sync(channel_layer.group_send)(
                    f'chat_{conversation.id}',
                    {
                        'type': 'message_update',
                        'message_id': original_message.id,
                        'metadata': original_message.metadata
                    }
                )
        except Exception as e:
            logger.warning(f"Konnte ursprüngliche Nachricht nicht aktualisieren: {e}")
    
    logger.info(f"{icon} Entscheidungs-Nachricht gesendet in Konversation {conversation.id}")
    return message


def send_absence_change_notification(conversation, absence, changed_by, changes):
    """
    Sendet eine Chat-Nachricht bei Änderung eines Antrags
    
    Args:
        conversation: ChatConversation Objekt
        absence: Absence Objekt
        changed_by: User der die Änderung vorgenommen hat
        changes: Dict mit Änderungen {field: {old, new}}
    """
    content = f"✏️ Abwesenheitsantrag wurde geändert und benötigt erneute Prüfung"
    
    metadata = {
        'absence_id': absence.id,
        'absence_type': absence.absence_type.display_name,
        'changes': changes,
        'changed_by': changed_by.get_full_name(),
        'status': absence.status
    }
    
    message = ChatMessage.objects.create(
        conversation=conversation,
        sender=changed_by,
        content=content,
        message_type='system',
        metadata=metadata,
        is_encrypted=False
    )
    
    # WebSocket-Broadcast
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'chat_{conversation.id}',
            {
                'type': 'chat_message',
                'message_id': message.id,
                'conversation_id': conversation.id,
                'sender': changed_by.username,
                'sender_name': changed_by.get_full_name(),
                'content': content,
                'message_type': 'system',
                'metadata': metadata,
                'is_encrypted': False,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    logger.info(f"✏️ Änderungs-Benachrichtigung gesendet in Konversation {conversation.id}")
    return message
