"""
Notifications Consumer für Chat-Benachrichtigungen
Sendet Updates über neue Nachrichten an alle Conversations eines Users
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import logging

logger = logging.getLogger(__name__)


class NotificationsConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer für Chat-Benachrichtigungen
    URL: ws://localhost:8000/ws/notifications/
    
    Sendet Benachrichtigungen über neue Nachrichten in allen Conversations des Users
    """
    
    async def connect(self):
        """Neue WebSocket-Verbindung"""
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # User-spezifischer Channel für Benachrichtigungen
        self.room_group_name = f'notifications_{self.user.id}'
        
        # User zu Group hinzufügen
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"✅ Notifications WebSocket verbunden für {self.user.username}")
    
    async def disconnect(self, close_code):
        """WebSocket-Verbindung beendet"""
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"⚫ Notifications WebSocket getrennt für {self.user.username}")
    
    async def receive(self, text_data):
        """Empfange Nachricht vom Client (wird nicht verwendet)"""
        pass
    
    # ========================================================================
    # GROUP SEND HANDLERS
    # ========================================================================
    
    async def new_message_notification(self, event):
        """Benachrichtigung über neue Nachricht zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'conversation_id': event['conversation_id'],
            'message_id': event['message_id'],
            'sender': event['sender'],
            'sender_name': event['sender_name'],
            'preview': event['preview'],
            'timestamp': event['timestamp']
        }))
    
    async def reaction_notification(self, event):
        """Benachrichtigung über Reaktion zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'reaction',
            'conversation_id': event['conversation_id'],
            'message_id': event['message_id'],
            'emoji': event['emoji'],
            'sender': event['sender'],
            'sender_name': event['sender_name'],
            'preview': event['preview'],
            'timestamp': event['timestamp']
        }))
    
    async def badge_update(self, event):
        """Badge-Update zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'badge_update',
            'badges': event['badges']
        }))

