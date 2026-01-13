#!/usr/bin/env python
"""Test: Performance der semantischen Suche"""
import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

queries = [
    'IT Support',
    'Rechnung',
    'blink',
    'Hardware kaputt',
    'Management',
]

print("⏱️ PERFORMANCE TEST: Semantische Suche")
print("=" * 60)

# Erster Durchlauf (Model wird geladen)
print("\n📊 ERSTER DURCHLAUF (mit Model-Laden):")
print("-" * 60)
for query in queries:
    start = time.time()
    results = search_profiles_semantic(query)
    duration = time.time() - start
    print(f"'{query}': {duration*1000:.0f}ms ({len(results)} Ergebnisse)")

# Zweiter Durchlauf (Model ist gecacht)
print("\n📊 ZWEITER DURCHLAUF (Model gecacht):")
print("-" * 60)
for query in queries:
    start = time.time()
    results = search_profiles_semantic(query)
    duration = time.time() - start
    print(f"'{query}': {duration*1000:.0f}ms ({len(results)} Ergebnisse)")

# Namensuche (ohne Embeddings)
print("\n📊 NAMEN-SUCHE (ohne KI):")
print("-" * 60)
name_queries = ['poffermanns', 'schmidt', 'testuser']
for query in name_queries:
    start = time.time()
    results = search_profiles_semantic(query)
    duration = time.time() - start
    print(f"'{query}': {duration*1000:.0f}ms ({len(results)} Ergebnisse)")
