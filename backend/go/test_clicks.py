#!/usr/bin/env python
"""Teste Click Tracking"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.search_models import SearchQuery, SearchClick
from django.contrib.auth import get_user_model

User = get_user_model()

print("\n📊 SEARCH QUERIES (letzte 10):\n")
for q in SearchQuery.objects.all().order_by('-created_at')[:10]:
    print(f"  {q.query_text:20} | User: {q.user.get_full_name() if q.user else 'Anonymous':20} | Ergebnisse: {q.result_count} | Klicks: {q.has_click}")
    avg = q.avg_score if q.avg_score else 0.0
    print(f"  {q.created_at} | Avg Score: {avg:.3f}")
    
    # Zeige Klicks
    clicks = SearchClick.objects.filter(search_query=q)
    if clicks.exists():
        for c in clicks:
            print(f"    → Klick auf: {c.clicked_profile.user.get_full_name()} (Pos {c.position}, Score {c.relevance_score:.3f})")
    print()

print(f"\n📈 STATISTIK:")
print(f"  Total Queries: {SearchQuery.objects.count()}")
print(f"  Total Clicks: {SearchClick.objects.count()}")
print(f"  Click Rate: {(SearchClick.objects.count() / SearchQuery.objects.count() * 100):.1f}%" if SearchQuery.objects.count() > 0 else "  No queries yet")
