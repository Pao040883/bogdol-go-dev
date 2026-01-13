#!/usr/bin/env python
"""Teste Click-Tracking Endpoint direkt"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.search_models import SearchQuery, SearchClick
from auth_user.models import UserProfile

User = get_user_model()

print("\n🧪 Teste Click-Tracking DIREKT in DB\n")

# Erstelle Query
admin = User.objects.filter(is_superuser=True).first()
query = SearchQuery.objects.create(
    user=admin,
    query_text='test-manager',
    result_count=1,
    avg_score=0.95
)

# Erstelle Click
patrick_profile = UserProfile.objects.get(user__email='p.offermanns@bogdol.gmbh')
click = SearchClick.objects.create(
    search_query=query,
    clicked_profile=patrick_profile,
    position=1,
    relevance_score=0.95
)

query.has_click = True
query.save()

print(f"✅ Query erstellt: '{query.query_text}'")
print(f"✅ Click erstellt: {click.clicked_profile.user.get_full_name()}")

print("\n📊 Alle Queries mit Klicks:\n")
for q in SearchQuery.objects.filter(has_click=True).order_by('-created_at')[:5]:
    print(f"  '{q.query_text}' von {q.user.get_full_name() if q.user else 'Anonymous'}")
    for c in q.clicks.all():
        print(f"    → {c.clicked_profile.user.get_full_name()} (Pos {c.position}, Score {c.relevance_score:.3f})")
    print()

print(f"\n📈 STATISTIK:")
print(f"  Total Queries: {SearchQuery.objects.count()}")
print(f"  Total Clicks: {SearchClick.objects.count()}")
print(f"  Queries mit Klicks: {SearchQuery.objects.filter(has_click=True).count()}")
