"""
JWT Authentication Middleware für WebSockets
"""
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_key):
    """Get user from JWT token"""
    try:
        # Validate token
        UntypedToken(token_key)
        
        # Decode token
        decoded_data = jwt_decode(
            token_key, 
            settings.SECRET_KEY, 
            algorithms=["HS256"]
        )
        
        # Get user
        from auth_user.models import CustomUser
        user = CustomUser.objects.get(id=decoded_data['user_id'])
        logger.info(f"✅ JWT Auth erfolgreich: {user.username}")
        return user
        
    except (InvalidToken, TokenError, KeyError) as e:
        logger.warning(f"⚠️ JWT Token ungültig: {e}")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"❌ JWT Auth Fehler: {e}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT Authentication Middleware für WebSockets
    
    Prüft Query-Parameter 'token' oder Header 'Authorization'
    """
    
    async def __call__(self, scope, receive, send):
        # Parse query string for token
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        logger.info(f"WebSocket Auth Versuch - Token vorhanden: {bool(token)}")
        
        # Authenticate with JWT or use AnonymousUser
        if token:
            user = await get_user_from_token(token)
        else:
            logger.warning("⚠️ Kein Token im WebSocket Request")
            user = AnonymousUser()
        
        # Set user in scope BEFORE calling parent
        scope['user'] = user
        
        # Call parent middleware
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Helper function to wrap URLRouter"""
    return JWTAuthMiddleware(inner)
