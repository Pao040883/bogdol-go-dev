#!/usr/bin/env python
"""
Testet ob Click-Learning Profile findet und hinzufügt
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.search_models import SearchQuery, SearchClick
from auth_user.learning_service import apply_learning_boosts
from auth_user.models import UserProfile
from django.contrib.auth import get_user_model

User = get_user_model()

# Testdaten
query_text = "rchnunh"
print(f"\n=== TESTE CLICK-LEARNING FÜR: '{query_text}' ===\n")

# 1. Zeige Klicks für diese Query
clicks = SearchClick.objects.filter(
    search_query__query_text__iexact=query_text
)
print(f"Gefundene Klicks: {clicks.count()}")
for click in clicks[:5]:
    print(f"  -> {click.clicked_profile.user.get_full_name()} (ID: {click.clicked_profile.pk})")

# 2. Teste Learning Service direkt
print(f"\n=== TESTE LEARNING SERVICE ===")
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count

cutoff_date = timezone.now() - timedelta(days=90)

# Genau wie in learning_service.py
click_data = SearchClick.objects.filter(
    search_query__query_text__iexact=query_text,
    search_query__created_at__gte=cutoff_date
).values('clicked_profile_id').annotate(
    click_count=Count('id')
).filter(click_count__gte=1)

print(f"Profile mit Klicks: {click_data.count()}")
for data in click_data:
    profile_id = data['clicked_profile_id']
    click_count = data['click_count']
    boost = min(click_count * 0.15, 0.5)
    
    try:
        profile = UserProfile.objects.get(pk=profile_id)
        print(f"  Profile ID {profile_id} ({profile.user.get_full_name()}): {click_count} Klicks = +{boost:.3f} Boost")
    except:
        print(f"  Profile ID {profile_id}: {click_count} Klicks = +{boost:.3f} Boost (Profile nicht gefunden)")

# 3. Teste apply_learning_boosts mit leeren Results
print(f"\n=== TESTE apply_learning_boosts MIT LEEREN RESULTS ===")
user = User.objects.get(username='poffermanns')
empty_results = []

boosted_results = apply_learning_boosts(empty_results, searcher_user=user, query_text=query_text)

print(f"Ergebnisse nach Boost: {len(boosted_results)}")
for result in boosted_results:
    profile = result['profile']
    score = result['score']
    print(f"  -> {profile.user.get_full_name()}: Score {score:.3f}")
    if 'added_by_click_learning' in result:
        print(f"     ✅ Durch Click-Learning hinzugefügt!")
