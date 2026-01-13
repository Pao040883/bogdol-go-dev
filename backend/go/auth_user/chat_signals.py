"""
Signals für Chat System
Automatische Updates bei Nachrichten-Events
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .chat_models import ChatMessage


@receiver(post_save, sender=ChatMessage)
def update_conversation_on_message(sender, instance, created, **kwargs):
    """
    Wenn eine neue Nachricht erstellt wird:
    - Stelle sicher dass Sender in participants ist
    - Aktualisiere last_message_at
    - Setze is_archived auf False (falls Chat archiviert war)
    - Entferne ChatConversationHidden für Empfänger (Chat wieder sichtbar machen)
    """
    if created and not instance.is_deleted:
        conversation = instance.conversation
        
        # Sender zur Konversation hinzufügen (falls noch nicht drin)
        if instance.sender and not conversation.participants.filter(id=instance.sender.id).exists():
            conversation.participants.add(instance.sender)
        
        # Update last_message_at
        conversation.last_message_at = instance.sent_at
        conversation.is_archived = False
        conversation.save(update_fields=['last_message_at', 'is_archived', 'updated_at'])
        
        # Wenn Chat für Empfänger versteckt war, wieder einblenden
        from .chat_models import ChatConversationHidden
        
        # Hole alle Teilnehmer außer dem Sender
        recipients = conversation.participants.exclude(id=instance.sender_id)
        
        # Entferne Hidden-Status für alle Empfänger
        ChatConversationHidden.objects.filter(
            conversation=conversation,
            user__in=recipients
        ).delete()
