#!/usr/bin/env python
"""
Prüft ob UserProfile für dkomsic existiert
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.profile_models import UserProfile

User = get_user_model()

print("=" * 60)
print("USERPROFILE CHECK - User: dkomsic")
print("=" * 60)

try:
    user = User.objects.get(username='dkomsic')
    print(f"\n✅ User gefunden: {user.username} ({user.get_full_name()})")
    print(f"   User ID: {user.id}")
    
    # Methode 1: Via Relation
    print("\n--- Methode 1: Via user.userprofile ---")
    if hasattr(user, 'userprofile'):
        print(f"   ✅ hasattr(user, 'userprofile') = True")
        try:
            profile = user.userprofile
            print(f"   ✅ UserProfile gefunden via Relation")
            print(f"   Profile ID: {profile.id}")
            if profile.direct_supervisor:
                print(f"   Vorgesetzter: {profile.direct_supervisor.user.username}")
            else:
                print(f"   Vorgesetzter: None")
        except Exception as e:
            print(f"   ❌ Fehler beim Zugriff: {e}")
    else:
        print(f"   ❌ hasattr(user, 'userprofile') = False")
    
    # Methode 2: Direkte DB-Abfrage
    print("\n--- Methode 2: Direkte DB-Abfrage ---")
    try:
        profile = UserProfile.objects.get(user=user)
        print(f"   ✅ UserProfile gefunden via DB-Query")
        print(f"   Profile ID: {profile.id}")
        if profile.direct_supervisor:
            print(f"   Vorgesetzter: {profile.direct_supervisor.user.username}")
        else:
            print(f"   Vorgesetzter: None")
    except UserProfile.DoesNotExist:
        print(f"   ❌ Kein UserProfile in DB gefunden für user_id={user.id}")
    
    # Methode 3: Alle UserProfiles anzeigen
    print("\n--- Alle UserProfiles (Sample) ---")
    all_profiles = UserProfile.objects.all()[:5]
    print(f"   Gesamt: {UserProfile.objects.count()} UserProfiles")
    for p in all_profiles:
        print(f"   - {p.user.username} (ID: {p.id}, user_id: {p.user_id})")
        
except User.DoesNotExist:
    print("❌ User 'dkomsic' nicht gefunden")
except Exception as e:
    print(f"❌ Fehler: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
