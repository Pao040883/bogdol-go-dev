"""
WebSocket URL Routing für Django Channels
"""
from django.urls import re_path
from .consumers import ChatConsumer, PresenceConsumer
from .notifications_consumer import NotificationsConsumer

websocket_urlpatterns = [
    # Chat WebSocket: ws://localhost:8000/ws/chat/1/
    re_path(r'ws/chat/(?P<conversation_id>\d+)/$', ChatConsumer.as_asgi()),
    
    # Presence WebSocket: ws://localhost:8000/ws/presence/
    re_path(r'ws/presence/$', PresenceConsumer.as_asgi()),
    
    # Notifications WebSocket: ws://localhost:8000/ws/notifications/
    re_path(r'ws/notifications/$', NotificationsConsumer.as_asgi()),
]
