#!/usr/bin/env python
"""Test: Namen- und E-Mail-Suche in KI-Suche"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

# Test-Queries
queries = [
    'poffermanns',
    'Offermanns',
    'testuser',
    'schmidt',
    'peter.offermanns',
    'blink',  # Keine Namenssuche
    'IT Support',  # Keine Namenssuche
]

print("🔍 TEST: Namen- und E-Mail-Suche")
print("=" * 60)

for query in queries:
    results = search_profiles_semantic(query)
    print(f"\n🔍 '{query}' - {len(results)} Ergebnisse")
    print("-" * 60)
    
    for i, result in enumerate(results[:3], 1):
        profile = result['profile']
        score = result['score']
        matched_fields = result.get('matched_fields', [])
        
        print(f"{i}. {profile.user.get_full_name()} - {score*100:.1f}%")
        
        if matched_fields:
            for field_name, field_value in matched_fields[:2]:
                # Kürze lange Werte
                display_value = field_value[:60] + "..." if len(field_value) > 60 else field_value
                print(f"   → {field_name}: {display_value}")
