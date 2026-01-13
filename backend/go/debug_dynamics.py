import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import UserProfile
from auth_user.embedding_service import search_profiles_semantic
from django.contrib.auth import get_user_model

User = get_user_model()

print("\n" + "="*60)
print("DEBUGGING: 'dynamics' Suche")
print("="*60)

# 1. Prüfe Profile Text
print("\n1. Profile mit 'dynamics' in Feldern:")
for profile in UserProfile.objects.all():
    fields_text = " ".join([
        profile.job_title or "",
        profile.responsibilities or "",
        profile.expertise_areas or "",
        profile.bio or ""
    ]).lower()
    
    if 'dynamics' in fields_text:
        print(f"  ✓ {profile.user.get_full_name()}")
        print(f"    Job: {profile.job_title}")
        print(f"    Expertise: {profile.expertise_areas[:100] if profile.expertise_areas else 'N/A'}")

# 2. Suche mit KI
print("\n2. KI-Suche nach 'dynamics':")
user = User.objects.first()
results = search_profiles_semantic("dynamics", user=user, top_k=10, track_query=False)

if results:
    for i, result in enumerate(results, 1):
        print(f"  {i}. {result['profile'].user.get_full_name()} - Score: {result['score']:.3f}")
else:
    print("  ⚠ Keine Ergebnisse!")

# 3. Prüfe Embeddings
print("\n3. Profile mit Embeddings:")
with_embeddings = UserProfile.objects.exclude(profile_embedding__isnull=True).exclude(profile_embedding=[])
print(f"  {with_embeddings.count()} Profile haben Embeddings")

print("\n" + "="*60)
