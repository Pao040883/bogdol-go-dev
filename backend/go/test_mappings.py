#!/usr/bin/env python
"""Test-Script für manuelle Profil-Zuordnungen"""

import os
import sys
import django

# Django Setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.search_models import SearchProfileMapping
from auth_user.profile_models import UserProfile
from django.contrib.auth import get_user_model

User = get_user_model()

def test_create_mapping():
    """Erstelle Test-Zuordnung: 'drucker' → IT Person"""
    print("\n=== TEST: Manuelle Profil-Zuordnung ===\n")
    
    # Suche IT-Person (z.B. jemand mit "IT" im Job-Title)
    it_profiles = UserProfile.objects.filter(job_title__icontains='it')[:5]
    
    if not it_profiles.exists():
        print("❌ Keine IT-Profile gefunden")
        return
    
    target_profile = it_profiles.first()
    print(f"✅ Ziel-Profil: {target_profile.user.get_full_name()} - {target_profile.job_title}")
    
    # Erstelle Zuordnung
    mapping, created = SearchProfileMapping.objects.get_or_create(
        query_term='drucker',
        profile=target_profile,
        defaults={
            'boost_score': 0.4,
            'priority': 10,
            'notes': 'IT-Support für Drucker-Probleme',
            'is_active': True
        }
    )
    
    if created:
        print(f"✅ Zuordnung erstellt: '{mapping.query_term}' → {mapping.profile.user.get_full_name()} (+{mapping.boost_score})")
    else:
        print(f"ℹ️  Zuordnung existiert bereits: {mapping}")
    
    return mapping


def test_search_with_mapping():
    """Teste Suche mit manueller Zuordnung"""
    print("\n=== TEST: Suche mit Zuordnung ===\n")
    
    from auth_user.embedding_service import search_profiles_semantic
    
    results = search_profiles_semantic('drucker', top_k=5)
    
    print(f"📊 Ergebnisse für 'drucker':")
    for i, result in enumerate(results, 1):
        profile = result['profile']
        score = result['score']
        original_score = result.get('original_score', score)
        manual_boost = result.get('manual_boost', 0)
        
        boost_info = ""
        if manual_boost > 0:
            boost_info = f" 🎯 MANUAL BOOST: +{manual_boost:.3f}"
        
        print(f"{i}. {profile.user.get_full_name()}: {original_score:.3f} → {score:.3f}{boost_info}")
        print(f"   {profile.job_title}")
    
    # Check ob Mapping wirkt
    if results:
        top_result = results[0]
        manual_boost = top_result.get('manual_boost', 0)
        if manual_boost > 0:
            print(f"\n✅ Manuelle Zuordnung wirkt! (+{manual_boost:.3f} Boost)")
        else:
            print(f"\n⚠️  Keine manuelle Zuordnung aktiv")


def test_multiple_mappings():
    """Teste mehrere Zuordnungen für ein Query"""
    print("\n=== TEST: Mehrere Zuordnungen ===\n")
    
    # Erstelle 2 Zuordnungen für 'support'
    profiles = UserProfile.objects.filter(job_title__icontains='it')[:2]
    
    for i, profile in enumerate(profiles, 1):
        mapping, created = SearchProfileMapping.objects.get_or_create(
            query_term='support',
            profile=profile,
            defaults={
                'boost_score': 0.5 - (i * 0.1),  # Erste Person höherer Boost
                'priority': 10 - i,
                'notes': f'Support-Kontakt #{i}',
                'is_active': True
            }
        )
        print(f"{'✅ Erstellt' if created else 'ℹ️  Exists'}: {mapping}")
    
    # Teste Suche
    from auth_user.embedding_service import search_profiles_semantic
    results = search_profiles_semantic('support', top_k=5)
    
    print(f"\n📊 Ergebnisse für 'support':")
    for i, result in enumerate(results, 1):
        profile = result['profile']
        manual_boost = result.get('manual_boost', 0)
        boost_marker = " 🎯" if manual_boost > 0 else ""
        print(f"{i}. {profile.user.get_full_name()}: {result['score']:.3f}{boost_marker}")


if __name__ == '__main__':
    # Test 1: Einfache Zuordnung
    test_create_mapping()
    
    # Test 2: Suche mit Zuordnung
    test_search_with_mapping()
    
    # Test 3: Mehrere Zuordnungen
    test_multiple_mappings()
    
    print("\n=== FERTIG ===\n")
