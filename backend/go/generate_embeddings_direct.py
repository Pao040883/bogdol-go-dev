"""
Generate embeddings directly (bypass Celery)
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import generate_profile_embedding
from auth_user.profile_models import UserProfile

profiles = UserProfile.objects.filter(
    is_searchable=True,
    user__is_active=True
)

print(f"🔄 Generating embeddings for {profiles.count()} profiles...")

success = 0
errors = 0

for profile in profiles:
    try:
        embedding = generate_profile_embedding(profile)
        if embedding:
            # SPEICHERN!
            profile.embedding_vector = embedding
            profile.save(update_fields=['embedding_vector', 'embedding_updated_at'])
            success += 1
            print(f"  ✅ {profile.user.username} (Vector Dim: {len(embedding)})")
        else:
            errors += 1
            print(f"  ❌ {profile.user.username} - No embedding generated")
    except Exception as e:
        errors += 1
        print(f"  ❌ {profile.user.username} - {e}")

print(f"\n✅ Success: {success}")
print(f"❌ Errors: {errors}")
