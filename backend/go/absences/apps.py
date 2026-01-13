from django.apps import AppConfig


class AbsencesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'absences'
    
    def ready(self):
        """Importiere Signals beim App-Start"""
        import absences.signals  # noqa
