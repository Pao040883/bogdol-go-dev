from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'auth_user'
    verbose_name = 'Benutzer & Profile'
    
    def ready(self):
        """Import signals when app is ready"""
        import auth_user.profile_signals  # Profile & Presence auto-creation
        import auth_user.chat_signals  # Chat auto-updates
        
        # KI-Model IMMER beim Start vorladen (verhindert 5-10s Wartezeit beim ersten Request)
        try:
            from auth_user.embedding_service import get_embedding_manager
            logger.info("🔄 Lade KI-Model für semantische Suche...")
            manager = get_embedding_manager()
            if manager.is_available():
                # Warming-up: Dummy-Embedding generieren um Model vollständig zu laden
                manager.generate("Warming up model")
                logger.info("✅ KI-Model erfolgreich vorgeladen und bereit")
            else:
                logger.warning("⚠️ KI-Model nicht verfügbar")
        except Exception as e:
            logger.warning(f"⚠️ KI-Model konnte nicht vorgeladen werden: {e}")
