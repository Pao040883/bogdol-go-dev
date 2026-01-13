from django.apps import AppConfig


class SofortmeldungConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sofortmeldung'
    
    def ready(self):
        """Import signals when the app is ready"""
        import sofortmeldung.signals
