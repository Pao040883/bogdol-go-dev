#!/usr/bin/env python
"""Prüfe ob Profile dynamics-Begriffe enthalten"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import UserProfile
from django.db.models import Q

terms = ['microsoft dynamics', 'erp', 'business central', 'crm', 'dynamics']

print("\n📊 Profile mit dynamics-bezogenen Begriffen:\n")
for term in terms:
    profiles = UserProfile.objects.filter(
        Q(job_title__icontains=term) | 
        Q(responsibilities__icontains=term) | 
        Q(expertise_areas__icontains=term)
    )
    count = profiles.count()
    print(f"{term}: {count} profiles")
    
    if count > 0:
        for p in profiles[:3]:
            print(f"  - {p.user.get_full_name()}: {p.job_title}")

# Teste die Suche
print("\n🔍 Teste Suche 'dynamics':\n")
from auth_user.embedding_service import search_profiles_semantic

results = search_profiles_semantic('dynamics', top_k=5)
print(f"Anzahl Ergebnisse: {len(results)}")
for i, r in enumerate(results, 1):
    print(f"{i}. {r['profile'].user.get_full_name()}: {r['score']:.3f}")
