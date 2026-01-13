#!/usr/bin/env python
"""Erstelle manuelle Mappings für bessere Suche"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.search_models import SearchProfileMapping
from auth_user.models import UserProfile
from django.contrib.auth import get_user_model

User = get_user_model()

# Finde IT/Dynamics User (Patrick als Abteilungsleiter)
patrick = User.objects.get(email='p.offermanns@bogdol.gmbh')
patrick_profile = UserProfile.objects.get(user=patrick)

print(f"\n✅ Patrick Offermanns gefunden: {patrick.get_full_name()}")
print(f"   Job: {patrick_profile.job_title}")

# Erstelle Mapping für "dynamics"
mapping, created = SearchProfileMapping.objects.get_or_create(
    query_term='dynamics',
    profile=patrick_profile,
    defaults={
        'boost_score': 0.8,
        'priority': 1,
        'notes': 'Abteilungsleiter - hauptverantwortlich für Dynamics/ERP Themen',
        'is_active': True,
        'created_by': patrick  # Admin user
    }
)

if created:
    print(f"\n✅ Mapping erstellt: 'dynamics' → {patrick.get_full_name()} (Boost: 0.8)")
else:
    print(f"\n⚠️  Mapping existiert bereits: 'dynamics' → {patrick.get_full_name()}")

# Erstelle auch Mappings für verwandte Begriffe
terms = ['erp', 'crm', 'microsoft dynamics', 'business central']
for term in terms:
    m, c = SearchProfileMapping.objects.get_or_create(
        query_term=term,
        profile=patrick_profile,
        defaults={
            'boost_score': 0.7,
            'priority': 2,
            'notes': f'Auto-mapping für Dynamics-verwandte Begriffe',
            'is_active': True,
            'created_by': patrick
        }
    )
    if c:
        print(f"✅ Mapping erstellt: '{term}' → {patrick.get_full_name()} (Boost: 0.7)")

print(f"\n📊 Total Mappings: {SearchProfileMapping.objects.count()}")
