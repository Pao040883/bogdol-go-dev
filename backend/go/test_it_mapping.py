#!/usr/bin/env python
"""Schnelltest für IT-Mapping"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

results = search_profiles_semantic('manager', top_k=5)

print("\n📊 MANAGER-Suche Ergebnisse:")
for i, r in enumerate(results, 1):
    manual = r.get('manual_boost', 0)
    marker = " 🎯" if manual > 0 else ""
    print(f"{i}. {r['profile'].user.get_full_name()}: {r['score']:.3f} (manual: +{manual:.3f}){marker}")
