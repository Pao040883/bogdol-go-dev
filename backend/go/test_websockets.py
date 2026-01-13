#!/usr/bin/env python
"""
Test WebSocket Consumers
"""
import os
import sys
import django
import asyncio
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/app')
django.setup()

from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from auth_user.consumers import ChatConsumer, PresenceConsumer
from auth_user.models import CustomUser
from auth_user.chat_models import ChatConversation
from auth_user.profile_models import UserPresence

print("=" * 70)
print("TEST SUITE: WebSocket Consumers")
print("=" * 70)

async def test_consumers():
    """Test WebSocket Consumers"""
    
    # Test 1: PresenceConsumer Import
    print("\n[1] PresenceConsumer überprüfen...")
    try:
        assert PresenceConsumer is not None
        print("    ✅ PresenceConsumer erfolgreich importiert")
    except Exception as e:
        print(f"    ❌ {e}")
        return False
    
    # Test 2: ChatConsumer Import
    print("\n[2] ChatConsumer überprüfen...")
    try:
        assert ChatConsumer is not None
        print("    ✅ ChatConsumer erfolgreich importiert")
    except Exception as e:
        print(f"    ❌ {e}")
        return False
    
    # Test 3: ASGI Application
    print("\n[3] ASGI Application überprüfen...")
    try:
        from config.asgi import application
        assert application is not None
        print("    ✅ ASGI Application geladen")
    except Exception as e:
        print(f"    ❌ {e}")
        return False
    
    # Test 4: Routing
    print("\n[4] WebSocket Routing überprüfen...")
    try:
        from auth_user.routing import websocket_urlpatterns
        assert len(websocket_urlpatterns) == 2
        print(f"    ✅ {len(websocket_urlpatterns)} WebSocket Routes registriert")
        for pattern in websocket_urlpatterns:
            print(f"       - {pattern.pattern}")
    except Exception as e:
        print(f"    ❌ {e}")
        return False
    
    # Test 5: Channel Layers
    print("\n[5] Channel Layers überprüfen...")
    try:
        from django.conf import settings
        assert 'CHANNEL_LAYERS' in dir(settings)
        assert settings.CHANNEL_LAYERS is not None
        backend = settings.CHANNEL_LAYERS['default']['BACKEND']
        assert 'Redis' in backend
        print(f"    ✅ Channel Layers konfiguriert: {backend}")
    except Exception as e:
        print(f"    ⚠️  {e}")
    
    # Test 6: Consumer Methods
    print("\n[6] Consumer-Methoden überprüfen...")
    try:
        # PresenceConsumer
        assert hasattr(PresenceConsumer, 'connect')
        assert hasattr(PresenceConsumer, 'disconnect')
        assert hasattr(PresenceConsumer, 'receive')
        assert hasattr(PresenceConsumer, 'user_status_changed')
        
        # ChatConsumer
        assert hasattr(ChatConsumer, 'connect')
        assert hasattr(ChatConsumer, 'disconnect')
        assert hasattr(ChatConsumer, 'receive')
        assert hasattr(ChatConsumer, 'chat_message')
        assert hasattr(ChatConsumer, 'typing_indicator')
        
        print("    ✅ Alle Consumer-Methoden vorhanden")
    except Exception as e:
        print(f"    ❌ {e}")
        return False
    
    return True

# Führe async Tests aus
if __name__ == '__main__':
    result = asyncio.run(test_consumers())
    
    print("\n" + "=" * 70)
    if result:
        print("✅ WEBSOCKET-CONFIGURATION OK")
        print("=" * 70)
        print("""
WebSocket Endpoints:
- Chat: ws://localhost:8000/ws/chat/{conversation_id}/
- Presence: ws://localhost:8000/ws/presence/

Zu erledigen:
1. Django Channels starten (mit Daphne ASGI-Server)
2. Frontend WebSocket-Clients implementieren
3. Test mit echten Verbindungen durchführen
        """)
    else:
        print("❌ FEHLER BEI WEBSOCKET-KONFIGURATION")
        print("=" * 70)
        sys.exit(1)
