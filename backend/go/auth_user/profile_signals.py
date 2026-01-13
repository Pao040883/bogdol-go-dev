"""
Signals für automatische Profile-Erstellung und Datenmigration
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .profile_models import UserProfile, UserPresence

User = get_user_model()


@receiver(pre_save, sender=User)
def handle_user_deactivation(sender, instance, **kwargs):
    """
    Signal: Wenn User deaktiviert wird, entferne ihn als Vorgesetzten bei allen Untergebenen
    """
    if instance.pk:  # Nur bei Updates, nicht bei CREATE
        try:
            old_instance = User.objects.get(pk=instance.pk)
            # Prüfe ob User von aktiv → inaktiv wechselt
            if old_instance.is_active and not instance.is_active:
                # Entferne diesen User als Vorgesetzten bei allen Untergebenen
                UserProfile.objects.filter(direct_supervisor=instance).update(direct_supervisor=None)
        except User.DoesNotExist:
            pass


@receiver(post_save, sender=User)
def create_user_profile_and_presence(sender, instance, created, **kwargs):
    """
    Signal: Erstellt automatisch UserProfile und UserPresence für neue User
    """
    # UserProfile erstellen oder holen
    profile, profile_created = UserProfile.objects.get_or_create(user=instance)
    
    # UserPresence erstellen oder holen
    presence, presence_created = UserPresence.objects.get_or_create(user=instance)
    
    # Bei neuen Usern: Migriere Daten aus deprecated Feldern
    if created or profile_created:
        migrate_deprecated_fields_to_profile(instance, profile)
    
    # Bei bestehenden Usern: Sync deprecated Felder zu Profile
    elif not created:
        sync_deprecated_fields_to_profile(instance, profile)


@receiver(post_save, sender=UserProfile)
def regenerate_embedding_on_profile_change(sender, instance, created, **kwargs):
    """
    Signal: Regeneriert Embedding wenn Profile-Daten sich ändern
    """
    # Nur wenn relevante Felder vorhanden sind
    if instance.is_searchable and (
        instance.responsibilities or 
        instance.expertise_areas or 
        instance.job_title
    ):
        # Importiere tasks hier um zirkuläre Imports zu vermeiden
        from .embedding_tasks import generate_profile_embedding_task
        
        # Starte async Task
        generate_profile_embedding_task.delay(instance.user_id)



def migrate_deprecated_fields_to_profile(user, profile):
    """
    Migration function is deprecated - CustomUser no longer has these fields.
    Kept for compatibility, but does nothing for new users.
    All profile data should be entered directly via UserProfile.
    """
    # All deprecated fields have been removed from CustomUser model
    # New users don't have: phone_number, mobil_number, job_title, supervisor
    # These are now only in UserProfile
    
    # No migration needed for new users
    pass
    
    # OBSOLETE CODE (kept for reference):
    # Old fields that were in CustomUser before migration:
    # - phone_number -> profile.phone_number
    # - supervisor -> profile.direct_supervisor


def sync_deprecated_fields_to_profile(user, profile):
    """
    Synchronisiert deprecated Felder zu Profile (falls noch genutzt)
    Nur für Übergangszeit - später entfernen
    """
    # Hier können wir später Sync-Logik hinzufügen falls nötig
    pass


@receiver(post_save, sender=User)
def ensure_all_relations(sender, instance, created, **kwargs):
    """
    Stellt sicher dass alle Beziehungen korrekt sind
    """
    # ContactProfile aus contacts app wird durch dessen eigene Signals erstellt
    pass
