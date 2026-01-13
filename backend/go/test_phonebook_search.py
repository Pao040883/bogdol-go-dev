#!/usr/bin/env python
"""Teste Phonebook-Suche"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

print("\n🔍 Teste Phonebook-Suche: 'offermanns'\n")

results = search_profiles_semantic('offermanns', top_k=10)

print(f"Anzahl Ergebnisse: {len(results)}\n")

if results:
    for i, r in enumerate(results, 1):
        print(f"{i}. {r['profile'].user.get_full_name()}")
        print(f"   Job: {r['profile'].job_title}")
        print(f"   Score: {r['score']:.3f}")
        print()
else:
    print("❌ Keine Ergebnisse gefunden!")
    
    # Prüfe ob User existiert
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    users = User.objects.filter(last_name__icontains='offermanns')
    print(f"\nUser mit 'offermanns': {users.count()}")
    for u in users:
        print(f"  - {u.get_full_name()} (ID: {u.id})")
