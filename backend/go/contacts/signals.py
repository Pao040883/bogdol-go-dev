from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import ContactProfile

User = get_user_model()


@receiver(post_save, sender=User)
def create_or_update_contact_profile(sender, instance, created, **kwargs):
    """
    Automatisch ContactProfile erstellen für neue User
    """
    if created:
        ContactProfile.objects.get_or_create(user=instance)
    else:
        # Falls kein Profil existiert (z.B. bei alten Usern), erstelle es
        ContactProfile.objects.get_or_create(user=instance)
