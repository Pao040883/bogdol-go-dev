#!/usr/bin/env python
"""
Test-Script für Learning-System (Click-Ranking, Personalisierung, Auto-Complete)
"""
import os
import sys
import django

# Django setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.embedding_service import search_profiles_semantic
from auth_user.learning_service import get_query_suggestions, get_related_queries, apply_learning_boosts
from auth_user.search_models import SearchQuery, SearchClick
from auth_user.profile_models import UserProfile

User = get_user_model()


def test_personalization():
    """Test Personalisierungs-Boosts"""
    print("\n" + "="*60)
    print("TEST 1: PERSONALISIERUNG")
    print("="*60)
    
    # Suche als Patrick Offermanns (IT)
    try:
        patrick_user = User.objects.get(email='p.offermanns@bogdol.gmbh')
        print(f"\n✓ Suchender: {patrick_user.get_full_name()}")
        
        results = search_profiles_semantic(
            query="it support",
            user=patrick_user,
            top_k=5,
            track_query=True
        )
        
        print(f"\n✓ Gefunden: {len(results)} Profile")
        for i, result in enumerate(results, 1):
            profile = result['profile']
            original = result.get('original_score', result['score'])
            boosted = result['score']
            boost = result.get('learning_boost', 0)
            
            dept = profile.primary_department.name if profile.primary_department else "Keine Abt."
            location = profile.office_location or "Kein Standort"
            
            print(f"\n{i}. {profile.user.get_full_name()}")
            print(f"   Abteilung: {dept}")
            print(f"   Standort: {location}")
            print(f"   Score: {original:.3f} → {boosted:.3f} (+{boost:.3f})")
            
            if boost > 0:
                print(f"   → PERSONALISIERT! ✨")
    
    except User.DoesNotExist:
        print("\n⚠ Patrick Offermanns nicht gefunden")


def test_click_learning():
    """Test Click-basiertes Re-Ranking"""
    print("\n" + "="*60)
    print("TEST 2: CLICK-BASIERTES LEARNING")
    print("="*60)
    
    # Simuliere: User sucht "blink" und klickt Patrick
    try:
        patrick_user = User.objects.get(email='p.offermanns@bogdol.gmbh')
        patrick_profile = patrick_user.profile
        
        # Erstelle Such-Query
        query = SearchQuery.objects.create(
            user=patrick_user,
            query_text="blink",
            result_count=3,
            avg_score=0.5
        )
        
        # Simuliere Click
        SearchClick.objects.create(
            search_query=query,
            clicked_profile=patrick_profile,
            position=1,
            relevance_score=0.598,
            time_on_page=45
        )
        
        print(f"\n✓ Click simuliert: Patrick @ Position 1 für 'blink'")
        
        # Neue Suche - sollte jetzt Patrick höher ranken
        results = search_profiles_semantic(
            query="blink",
            user=patrick_user,
            top_k=5,
            track_query=True
        )
        
        print(f"\n✓ Neue Suche mit Click-History:")
        for i, result in enumerate(results, 1):
            profile = result['profile']
            boost = result.get('learning_boost', 0)
            
            print(f"{i}. {profile.user.get_full_name()} - Score: {result['score']:.3f}")
            if boost > 0:
                print(f"   → Click-Boost: +{boost:.3f} ⭐")
    
    except Exception as e:
        print(f"\n⚠ Fehler: {e}")


def test_autocomplete():
    """Test Auto-Complete"""
    print("\n" + "="*60)
    print("TEST 3: AUTO-COMPLETE")
    print("="*60)
    
    # Erstelle Test-Queries
    test_queries = [
        "blink integration",
        "blink system",
        "blinker",
        "drucker support",
        "drucker installation",
    ]
    
    try:
        user = User.objects.first()
        
        for q in test_queries:
            SearchQuery.objects.create(
                user=user,
                query_text=q,
                result_count=3,
                avg_score=0.5
            )
        
        print(f"\n✓ {len(test_queries)} Test-Queries erstellt")
        
        # Test Auto-Complete
        test_inputs = ["bli", "blink", "dru"]
        
        for inp in test_inputs:
            suggestions = get_query_suggestions(inp, limit=5)
            print(f"\n'{inp}' → {suggestions}")
    
    except Exception as e:
        print(f"\n⚠ Fehler: {e}")


def test_related_queries():
    """Test verwandte Queries"""
    print("\n" + "="*60)
    print("TEST 4: VERWANDTE QUERIES")
    print("="*60)
    
    try:
        user = User.objects.first()
        
        # Simuliere: User sucht mehrere verwandte Dinge
        related_searches = [
            "drucker",
            "scanner",
            "kopierer",
            "it support"
        ]
        
        for q in related_searches:
            SearchQuery.objects.create(
                user=user,
                query_text=q,
                result_count=5,
                avg_score=0.6
            )
        
        print(f"\n✓ Verwandte Suchen simuliert")
        
        # Finde verwandte Queries
        related = get_related_queries("drucker", limit=5)
        print(f"\nVerwandt zu 'drucker': {related}")
    
    except Exception as e:
        print(f"\n⚠ Fehler: {e}")


if __name__ == "__main__":
    print("\n🧠 LEARNING-SYSTEM TESTS")
    print("="*60)
    
    test_personalization()
    test_click_learning()
    test_autocomplete()
    test_related_queries()
    
    print("\n" + "="*60)
    print("✓ Tests abgeschlossen")
    print("="*60 + "\n")
