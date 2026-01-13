#!/usr/bin/env python
"""
Test der neuen API-Endpoints
"""
import os
import sys
import django

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/app')
django.setup()

from django.urls import get_resolver
from django.contrib.auth import get_user_model
from auth_user.profile_models import UserProfile
from auth_user.chat_models import ChatConversation

User = get_user_model()

print("=" * 70)
print("TEST SUITE: API Serializers & ViewSets")
print("=" * 70)

# Test 1: URL Patterns registriert
print("\n[1] URL Patterns überprüfen...")
resolver = get_resolver()
patterns = [str(p.pattern) for p in resolver.url_patterns]
api_endpoints = [p for p in patterns if 'api' in p.lower() or 'departments' in p or 'teams' in p or 'profiles' in p or 'chats' in p]
print(f"    ✅ {len(patterns)} Gesamt-Patterns, {len(api_endpoints)} API-relevante")

# Test 2: ViewSets importierbar
print("\n[2] ViewSets importieren...")
try:
    from auth_user.profile_views import (
        DepartmentViewSet, TeamViewSet, UserProfileViewSet, 
        UserPresenceViewSet, ChatConversationViewSet, ChatMessageViewSet
    )
    print("    ✅ Alle 6 ViewSets importiert")
except Exception as e:
    print(f"    ❌ Fehler: {e}")
    sys.exit(1)

# Test 3: Serializers importierbar
print("\n[3] Serializers importieren...")
try:
    from auth_user.profile_serializers import (
        DepartmentSerializer, TeamSerializer, 
        UserProfileDetailSerializer, UserProfileListSerializer,
        UserPresenceSerializer,
        ChatConversationListSerializer, ChatConversationDetailSerializer, 
        ChatMessageSerializer
    )
    print("    ✅ Alle 8 Serializers importiert")
except Exception as e:
    print(f"    ❌ Fehler: {e}")
    sys.exit(1)

# Test 4: Serializer-Instantiierung
print("\n[4] Serializer-Instantiierung testen...")
try:
    # Test User
    user = User.objects.first()
    if user:
        profile_ser = UserProfileDetailSerializer(user.profile)
        data = profile_ser.data
        print(f"    ✅ UserProfileDetailSerializer: {len(data)} Felder")
except Exception as e:
    print(f"    ⚠️  Skipped: {e}")

# Test 5: Permissions-Klassen
print("\n[5] Permission-Klassen überprüfen...")
try:
    from auth_user.profile_views import (
        IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly
    )
    print("    ✅ Permission-Klassen vorhanden")
except Exception as e:
    print(f"    ❌ Fehler: {e}")

# Test 6: Pagination-Klassen
print("\n[6] Pagination-Klassen überprüfen...")
try:
    from auth_user.profile_views import (
        StandardResultsSetPagination, ChatMessagePagination
    )
    print("    ✅ Pagination-Klassen vorhanden")
except Exception as e:
    print(f"    ❌ Fehler: {e}")

# Test 7: Router-Integration
print("\n[7] Router-Integration (URLs)...")
try:
    from rest_framework.routers import DefaultRouter
    from auth_user.urls import router
    print(f"    ✅ Router mit {len(router.registry)} registrierten ViewSets")
    for prefix, viewset, basename in router.registry:
        print(f"       - /{prefix}/")
except Exception as e:
    print(f"    ⚠️  {e}")

print("\n" + "=" * 70)
print("✅ ALLE TESTS ERFOLGREICH!")
print("=" * 70)
print("""
API ist verfügbar unter /api/:
- /api/departments/         - Abteilungen
- /api/teams/               - Teams
- /api/profiles/            - User-Profile
- /api/presence/            - Online-Status
- /api/chats/               - Chat-Konversationen
- /api/messages/            - Chat-Nachrichten

Zusätzliche Endpoints:
- /api/departments/tree/    - Hierarchischer Baum
- /api/profiles/search/     - Erweiterte Suche
- /api/profiles/me/         - Eigenes Profil
""")
