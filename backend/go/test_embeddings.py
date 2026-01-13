#!/usr/bin/env python
"""
Test Suite für KI-Embedding Service
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/app')
django.setup()

from auth_user.embedding_service import (
    EmbeddingManager, SentenceTransformersProvider, 
    generate_profile_embedding, get_embedding_manager
)
from auth_user.profile_models import UserProfile
from django.contrib.auth import get_user_model

User = get_user_model()

print("=" * 70)
print("TEST SUITE: KI-Embedding Service")
print("=" * 70)

# Test 1: Manager laden
print("\n[1] EmbeddingManager initialisieren...")
try:
    manager = get_embedding_manager()
    available = manager.is_available()
    print(f"    ✅ Manager geladen, Provider verfügbar: {available}")
except Exception as e:
    print(f"    ⚠️  {e}")
    print(f"    💡 Tipp: pip install sentence-transformers")

# Test 2: Provider-Typ überprüfen
print("\n[2] Provider-Typ überprüfen...")
try:
    manager = EmbeddingManager()
    if manager._provider:
        provider_class = manager._provider.__class__.__name__
        print(f"    ✅ Provider: {provider_class}")
except Exception as e:
    print(f"    ⚠️  {e}")

# Test 3: Test-Text Embedding
print("\n[3] Test-Embedding generieren...")
try:
    manager = get_embedding_manager()
    if manager.is_available():
        test_text = "Python Developer mit 5 Jahren Erfahrung"
        embedding = manager.generate(test_text)
        if embedding:
            print(f"    ✅ Embedding generiert, Dimensionen: {len(embedding)}")
        else:
            print(f"    ❌ Embedding ist None")
    else:
        print(f"    ⚠️  Provider nicht verfügbar")
except Exception as e:
    print(f"    ⚠️  {e}")

# Test 4: Batch-Generierung
print("\n[4] Batch-Generierung testen...")
try:
    manager = get_embedding_manager()
    if manager.is_available():
        texts = [
            "Frontend Developer mit Angular",
            "Backend Engineer mit Django",
            "DevOps Spezialist"
        ]
        embeddings = manager.generate_batch(texts)
        valid_count = sum(1 for e in embeddings if e)
        print(f"    ✅ {valid_count}/{len(texts)} Embeddings generiert")
except Exception as e:
    print(f"    ⚠️  {e}")

# Test 5: Profil-Embedding
print("\n[5] Profil-Embedding testen...")
try:
    user = User.objects.first()
    if user and hasattr(user, 'profile'):
        profile = user.profile
        embedding = generate_profile_embedding(profile)
        if embedding:
            print(f"    ✅ Profil-Embedding generiert ({profile.user.username})")
        else:
            print(f"    ⚠️  Embedding für Profil nicht generiert")
    else:
        print(f"    ⚠️  Kein User/Profile gefunden")
except Exception as e:
    print(f"    ⚠️  {e}")

# Test 6: Cosine Similarity
print("\n[6] Cosine Similarity testen...")
try:
    manager = get_embedding_manager()
    if manager.is_available():
        vec1 = manager.generate("Python Developer")
        vec2 = manager.generate("Python Programmierer")
        vec3 = manager.generate("Grafik Designer")
        
        if vec1 and vec2 and vec3:
            sim12 = manager._provider.cosine_similarity(vec1, vec2)
            sim13 = manager._provider.cosine_similarity(vec1, vec3)
            print(f"    ✅ Python Dev <-> Python Prog: {sim12:.3f}")
            print(f"    ✅ Python Dev <-> Designer: {sim13:.3f}")
except Exception as e:
    print(f"    ⚠️  {e}")

# Test 7: Semantic Search
print("\n[7] Semantic Search testen...")
try:
    from auth_user.embedding_service import search_profiles_semantic
    manager = get_embedding_manager()
    if manager.is_available():
        results = search_profiles_semantic("Python Developer", top_k=5)
        if results:
            count = results.count()
            print(f"    ✅ Suche durchgeführt, {count} Ergebnisse gefunden")
        else:
            print(f"    ℹ️  Keine searchable Profile mit Embeddings")
    else:
        print(f"    ⚠️  Provider nicht verfügbar")
except Exception as e:
    print(f"    ⚠️  {e}")

# Test 8: Embedding Tasks
print("\n[8] Embedding Tasks überprüfen...")
try:
    from auth_user.embedding_tasks import (
        generate_profile_embedding_task,
        regenerate_all_embeddings_task,
        semantic_search_profiles_task
    )
    print(f"    ✅ Alle Embedding-Tasks importiert")
except Exception as e:
    print(f"    ❌ {e}")

print("\n" + "=" * 70)
print("✅ EMBEDDING-SERVICE TEST ABGESCHLOSSEN")
print("=" * 70)
print("""
Verwendung:

1. Embeddings generieren:
   from auth_user.embedding_service import get_embedding_manager
   manager = get_embedding_manager()
   embedding = manager.generate("Text zum Embedding")

2. Semantische Suche:
   from auth_user.embedding_service import search_profiles_semantic
   results = search_profiles_semantic("Python Developer", top_k=5)

3. Hintergrund-Tasks:
   from auth_user.embedding_tasks import generate_profile_embedding_task
   generate_profile_embedding_task.delay(profile_id)

4. API-Endpoint:
   GET /api/profiles/search/?q=Python&semantic=true
""")
