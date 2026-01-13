"""
WebSocket Consumers für RealTime Chat & Presence
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import CustomUser
from .chat_models import ChatConversation, ChatMessage
from .profile_models import UserPresence

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================================
# CHAT CONSUMER
# ============================================================================

class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer für 1:1 und Group Chats
    URL: ws://localhost:8000/ws/chat/{conversation_id}/
    """
    
    async def connect(self):
        """Neue WebSocket-Verbindung"""
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope['user']
        
        # Authentifizierung überprüfen
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # User in Konversation überprüfen
        if not await self.user_in_conversation():
            await self.close()
            return
        
        # User zu Group hinzufügen
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"✅ User {self.user.username} verbunden zu Chat {self.conversation_id}")
        
        # Benachrichtige andere User
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'username': self.user.username,
                'full_name': self.user.get_full_name()
            }
        )
    
    async def disconnect(self, close_code):
        """WebSocket-Verbindung beendet"""
        if self.user.is_authenticated:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_left',
                    'username': self.user.username
                }
            )
        
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"⚫ User {self.user.username} getrennt von Chat {self.conversation_id}")
    
    async def receive(self, text_data):
        """Empfange Nachricht vom Client"""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_error('Invalid JSON')
            return
        
        message_type = data.get('type')
        
        if message_type == 'message':
            await self.handle_new_message(data)
        elif message_type == 'typing':
            await self.handle_typing_indicator(data)
        elif message_type == 'mark_read':
            await self.handle_mark_read(data)
        elif message_type == 'reaction':
            await self.handle_reaction(data)
        else:
            await self.send_error(f'Unknown message type: {message_type}')
    
    async def handle_new_message(self, data):
        """Neue Chat-Nachricht speichern und broadcasten"""
        content = data.get('content', '').strip()
        
        if not content and not data.get('file'):
            await self.send_error('Message content required')
            return
        
        # E2E Verschlüsselung Flag
        is_encrypted = data.get('is_encrypted', False)
        
        # Nachricht in DB speichern
        message_id = await self.save_message(
            content=content,
            message_type=data.get('message_type', 'text'),
            file_data=data.get('file'),
            reply_to_id=data.get('reply_to'),
            is_encrypted=is_encrypted
        )
        
        if not message_id:
            await self.send_error('Failed to save message')
            return
        
        timestamp = __import__('django.utils.timezone', fromlist=['now']).now().isoformat()
        
        # An alle Clients in der Gruppe senden
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message_id': message_id,
                'conversation_id': self.conversation_id,  # Füge conversation_id hinzu
                'sender': self.user.username,
                'sender_name': self.user.get_full_name(),
                'content': content,
                'message_type': data.get('message_type', 'text'),
                'is_encrypted': is_encrypted,
                'timestamp': timestamp
            }
        )
        
        # Benachrichtigungen an alle Participants der Conversation senden
        await self.send_notifications_to_participants(
            message_id=message_id,
            content=content,
            message_type=data.get('message_type', 'text'),
            timestamp=timestamp
        )
    
    async def handle_typing_indicator(self, data):
        """Typing Indicator broadcasten"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'username': self.user.username,
                'is_typing': data.get('is_typing', True)
            }
        )
    
    async def handle_mark_read(self, data):
        """Nachricht als gelesen markieren"""
        message_id = data.get('message_id')
        if message_id:
            await self.mark_message_read(message_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'message_read',
                    'message_id': message_id,
                    'username': self.user.username
                }
            )
    
    async def handle_reaction(self, data):
        """Emoji-Reaktion hinzufügen"""
        message_id = data.get('message_id')
        emoji = data.get('emoji')
        
        if message_id and emoji:
            await self.add_reaction(message_id, emoji)
            
            # Broadcast to chat participants
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'message_reaction',
                    'message_id': message_id,
                    'emoji': emoji,
                    'username': self.user.username
                }
            )
            
            # Send notification to other participants
            participant_ids = await self.get_conversation_participants()
            for user_id in participant_ids:
                await self.channel_layer.group_send(
                    f'notifications_{user_id}',
                    {
                        'type': 'reaction_notification',
                        'conversation_id': self.conversation_id,
                        'message_id': message_id,
                        'emoji': emoji,
                        'sender': self.user.username,
                        'sender_name': self.user.get_full_name(),
                        'preview': f'Hat mit {emoji} reagiert',
                        'timestamp': __import__('django.utils.timezone', fromlist=['now']).now().isoformat()
                    }
                )
    
    # ========================================================================
    # GROUP SEND HANDLERS
    # ========================================================================
    
    async def chat_message(self, event):
        """Nachricht zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message_id': event['message_id'],
            'conversation_id': event.get('conversation_id'),
            'sender': event['sender'],
            'sender_name': event['sender_name'],
            'content': event['content'],
            'message_type': event.get('message_type', 'text'),
            'metadata': event.get('metadata', {}),
            'is_encrypted': event.get('is_encrypted', False),
            'timestamp': event['timestamp']
        }))
    
    async def message_update(self, event):
        """Nachricht-Update zu Client senden (z.B. Status-Änderung)"""
        await self.send(text_data=json.dumps({
            'type': 'message_update',
            'message_id': event['message_id'],
            'metadata': event.get('metadata', {})
        }))
    
    async def user_joined(self, event):
        """User-joined Benachrichtigung"""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'username': event['username'],
            'full_name': event['full_name']
        }))
    
    async def user_left(self, event):
        """User-left Benachrichtigung"""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'username': event['username']
        }))
    
    async def typing_indicator(self, event):
        """Typing Indicator zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'username': event['username'],
            'is_typing': event['is_typing']
        }))
    
    async def message_read(self, event):
        """Message Read Status zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'message_read',
            'message_id': event['message_id'],
            'username': event['username']
        }))
    
    async def message_reaction(self, event):
        """Reaction zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'reaction',
            'message_id': event['message_id'],
            'emoji': event['emoji'],
            'username': event['username']
        }))
    
    # ========================================================================
    # DATABASE OPERATIONS
    # ========================================================================
    
    @database_sync_to_async
    def user_in_conversation(self):
        """Überprüfe ob User in Konversation ist"""
        try:
            conversation = ChatConversation.objects.get(id=self.conversation_id)
            return self.user in conversation.participants.all()
        except ChatConversation.DoesNotExist:
            return False
    
    @database_sync_to_async
    def save_message(self, content, message_type='text', file_data=None, reply_to_id=None, is_encrypted=False):
        """Speichere Nachricht in DB"""
        try:
            conversation = ChatConversation.objects.get(id=self.conversation_id)
            
            # Erstelle Message
            message = ChatMessage.objects.create(
                conversation=conversation,
                sender=self.user,
                content=content,
                message_type=message_type,
                is_encrypted=is_encrypted
            )
            
            # Reply-to setzen
            if reply_to_id:
                try:
                    reply_to = ChatMessage.objects.get(id=reply_to_id)
                    message.reply_to = reply_to
                    message.save()
                except ChatMessage.DoesNotExist:
                    pass
            
            # Update conversation last_message_at
            conversation.last_message_at = __import__('django.utils.timezone', fromlist=['now']).now()
            conversation.save(update_fields=['last_message_at'])
            
            logger.info(f"✅ Nachricht {message.id} gespeichert")
            return message.id
        
        except Exception as e:
            logger.error(f"❌ Fehler beim Speichern: {e}")
            return None
    
    @database_sync_to_async
    def mark_message_read(self, message_id):
        """Markiere Nachricht als gelesen"""
        try:
            message = ChatMessage.objects.get(id=message_id)
            message.read_by.add(self.user)
            return True
        except ChatMessage.DoesNotExist:
            return False
    
    @database_sync_to_async
    def get_conversation_participants(self):
        """Hole alle Participants der Conversation außer dem aktuellen User"""
        try:
            conversation = ChatConversation.objects.get(id=self.conversation_id)
            # Alle Participants außer dem Sender
            return list(conversation.participants.exclude(id=self.user.id).values_list('id', flat=True))
        except ChatConversation.DoesNotExist:
            return []
    
    async def send_notifications_to_participants(self, message_id, content, message_type, timestamp):
        """Sende Benachrichtigung an alle Participants der Conversation"""
        participant_ids = await self.get_conversation_participants()
        
        # Preview erstellen basierend auf message_type
        if message_type == 'file':
            preview = '📎 Datei gesendet'
        elif message_type == 'image':
            preview = '🖼️ Bild gesendet'
        else:
            # Text-Nachricht: erste 50 Zeichen
            preview = content[:50] + '...' if len(content) > 50 else content
        
        # An jeden Participant eine Benachrichtigung senden
        for user_id in participant_ids:
            await self.channel_layer.group_send(
                f'notifications_{user_id}',
                {
                    'type': 'new_message_notification',
                    'conversation_id': self.conversation_id,
                    'message_id': message_id,
                    'sender': self.user.username,
                    'sender_name': self.user.get_full_name(),
                    'preview': preview,
                    'timestamp': timestamp
                }
            )
    
    @database_sync_to_async
    def add_reaction(self, message_id, emoji):
        """Füge Emoji-Reaktion hinzu"""
        try:
            message = ChatMessage.objects.get(id=message_id)
            if not message.reactions:
                message.reactions = {}
            
            if emoji not in message.reactions:
                message.reactions[emoji] = []
            
            if self.user.username not in message.reactions[emoji]:
                message.reactions[emoji].append(self.user.username)
                message.save(update_fields=['reactions'])
            
            return True
        except ChatMessage.DoesNotExist:
            return False
    
    async def send_error(self, error_message):
        """Sende Fehler zu Client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': error_message
        }))


# ============================================================================
# PRESENCE CONSUMER
# ============================================================================

class PresenceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer für Online/Offline Status
    URL: ws://localhost:8000/ws/presence/
    """
    
    async def connect(self):
        """Neue WebSocket-Verbindung"""
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_group_name = 'presence_updates'
        
        # User zu Group hinzufügen
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Setze User als online
        await self.set_user_online()
        
        # 1. ZUERST: Sende Liste aller bereits online User an den neuen User
        online_users = await self.get_online_users()
        await self.send(text_data=json.dumps({
            'type': 'online_users_list',
            'users': online_users
        }))
        
        # 2. DANN: Benachrichtige andere User über neuen Online-User
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status_changed',
                'username': self.user.username,
                'status': 'online',
                'full_name': self.user.get_full_name()
            }
        )
        
        logger.info(f"✅ User {self.user.username} online")
    
    async def disconnect(self, close_code):
        """WebSocket-Verbindung beendet"""
        if self.user.is_authenticated:
            # Setze User als offline
            await self.set_user_offline()
            
            # Benachrichtige andere User
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status_changed',
                    'username': self.user.username,
                    'status': 'offline',
                    'full_name': self.user.get_full_name()
                }
            )
        
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        logger.info(f"⚫ User {self.user.username} offline")
    
    async def receive(self, text_data):
        """Empfange Status-Update vom Client"""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        
        message_type = data.get('type')
        
        if message_type == 'status_change':
            status = data.get('status', 'online')  # online, away, busy, offline
            status_message = data.get('message', '')
            
            await self.update_user_status(status, status_message)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status_changed',
                    'username': self.user.username,
                    'status': status,
                    'status_message': status_message,
                    'full_name': self.user.get_full_name()
                }
            )
    
    # ========================================================================
    # GROUP SEND HANDLERS
    # ========================================================================
    
    async def user_status_changed(self, event):
        """Status-Update zu Client senden"""
        await self.send(text_data=json.dumps({
            'type': 'status_changed',
            'username': event['username'],
            'status': event['status'],
            'status_message': event.get('status_message', ''),
            'full_name': event['full_name']
        }))
    
    # ========================================================================
    # DATABASE OPERATIONS
    # ========================================================================
    
    @database_sync_to_async
    def set_user_online(self):
        """Markiere User als online"""
        try:
            presence = UserPresence.objects.get(user=self.user)
            presence.status = 'online'
            presence.websocket_channel_name = self.channel_name
            presence.save(update_fields=['status', 'websocket_channel_name', 'updated_at'])
            return True
        except UserPresence.DoesNotExist:
            return False
    
    @database_sync_to_async
    def get_online_users(self):
        """Hole alle aktuell online User (nur mit aktiver WebSocket-Verbindung)"""
        online_presences = UserPresence.objects.filter(
            status='online',
            websocket_channel_name__isnull=False
        ).exclude(
            websocket_channel_name=''
        ).exclude(
            user=self.user  # Eigenen User ausschließen
        ).select_related('user')
        
        return [
            {
                'username': p.user.username,
                'full_name': p.user.get_full_name(),
                'status': p.status
            }
            for p in online_presences
        ]
    
    @database_sync_to_async
    def set_user_offline(self):
        """Markiere User als offline"""
        try:
            presence = UserPresence.objects.get(user=self.user)
            presence.status = 'offline'
            presence.websocket_channel_name = ''
            presence.save(update_fields=['status', 'websocket_channel_name', 'updated_at'])
            return True
        except UserPresence.DoesNotExist:
            return False
    
    @database_sync_to_async
    def update_user_status(self, status, status_message=''):
        """Update User Status"""
        try:
            presence = UserPresence.objects.get(user=self.user)
            presence.status = status
            if status_message:
                presence.status_message = status_message
            presence.save(update_fields=['status', 'status_message', 'updated_at'])
            return True
        except UserPresence.DoesNotExist:
            return False
