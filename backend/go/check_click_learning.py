#!/usr/bin/env python
"""
Prüft ob Click-Learning Daten vorhanden sind
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.search_models import SearchQuery, SearchClick
from django.contrib.auth import get_user_model

User = get_user_model()

print("\n=== LETZTE 10 SUCHANFRAGEN ===")
queries = SearchQuery.objects.all().order_by('-created_at')[:10]
for q in queries:
    clicks = SearchClick.objects.filter(search_query=q)
    clicks_count = clicks.count()
    print(f"{q.id}: \"{q.query_text}\" von {q.user.username} ({q.created_at.strftime('%H:%M:%S')}) - Klicks: {clicks_count}")

print("\n=== LETZTE 10 KLICKS ===")
clicks = SearchClick.objects.all().order_by('-created_at')[:10]
for c in clicks:
    print(f"{c.id}: \"{c.search_query.query_text}\" -> {c.clicked_profile.user.get_full_name()} (Pos: {c.position}, Score: {c.relevance_score:.3f})")

print("\n=== CLICK STATISTICS ===")
print(f"Total Queries: {SearchQuery.objects.count()}")
print(f"Total Clicks: {SearchClick.objects.count()}")

# Prüfe spezifisch nach Queries mit mehreren Klicks
print("\n=== QUERIES MIT MEHREREN KLICKS (zum Lernen) ===")
from django.db.models import Count
queries_with_clicks = SearchQuery.objects.annotate(
    click_count=Count('clicks')
).filter(click_count__gte=1).order_by('-click_count')[:5]

for q in queries_with_clicks:
    print(f"\n\"{q.query_text}\" ({q.click_count} Klicks):")
    clicks = SearchClick.objects.filter(search_query=q)
    for click in clicks:
        print(f"  -> {click.clicked_profile.user.get_full_name()} (Pos: {click.position})")
