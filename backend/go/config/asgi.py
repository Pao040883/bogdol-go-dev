"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

# WebSocket URL Routing und JWT Auth importieren
from auth_user.routing import websocket_urlpatterns
from auth_user.jwt_auth_middleware import JWTAuthMiddlewareStack

application = ProtocolTypeRouter({
    # HTTP & HTTPS
    "http": django_asgi_app,
    
    # WebSocket mit JWT Authentication
    "websocket": JWTAuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
