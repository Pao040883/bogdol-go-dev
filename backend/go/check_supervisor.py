#!/usr/bin/env python
"""
Prüft den Vorgesetzten von dkomsic
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.profile_models import UserProfile

User = get_user_model()

print("=" * 60)
print("SUPERVISOR CHECK - User: dkomsic")
print("=" * 60)

# User dkomsic
try:
    dkomsic = User.objects.get(username='dkomsic')
    print(f"\n✅ User: {dkomsic.username} ({dkomsic.get_full_name()})")
    
    if hasattr(dkomsic, 'userprofile'):
        profile = dkomsic.userprofile
        if profile.direct_supervisor:
            sup_user = profile.direct_supervisor.user
            print(f"   Direct Supervisor: {sup_user.username} ({sup_user.get_full_name()})")
        else:
            print(f"   Direct Supervisor: None")
    else:
        print("   ❌ Kein UserProfile!")
        
except User.DoesNotExist:
    print("❌ User 'dkomsic' nicht gefunden!")

print("\n" + "=" * 60)
print("LETZTE ABWESENHEIT VON dkomsic")
print("=" * 60)

from absences.models import Absence

try:
    latest_absence = Absence.objects.filter(user__username='dkomsic').order_by('-created_at').first()
    if latest_absence:
        print(f"\nAbsence ID: {latest_absence.id}")
        print(f"Typ: {latest_absence.absence_type.display_name}")
        print(f"Von: {latest_absence.start_date}")
        print(f"Bis: {latest_absence.end_date}")
        print(f"Status: {latest_absence.status}")
        print(f"Vertretung (representative): {latest_absence.representative.username if latest_absence.representative else 'None'}")
        
        if latest_absence.conversation:
            conv = latest_absence.conversation
            print(f"\nKonversation ID: {conv.id}")
            print(f"Teilnehmer:")
            for participant in conv.participants.all():
                print(f"  - {participant.username} ({participant.get_full_name()})")
        else:
            print("\n❌ Keine Konversation verknüpft!")
    else:
        print("\n❌ Keine Abwesenheit gefunden!")
except Exception as e:
    print(f"❌ Fehler: {e}")

print("\n" + "=" * 60)
