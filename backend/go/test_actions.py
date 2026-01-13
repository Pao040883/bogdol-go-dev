#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_views import UserProfileViewSet

print("=== UserProfileViewSet Actions ===")
for attr in dir(UserProfileViewSet):
    if attr.startswith('_'):
        continue
    obj = getattr(UserProfileViewSet, attr, None)
    if obj and hasattr(obj, 'mapping'):
        url_path = getattr(obj, 'url_path', attr.replace('_', '-'))
        print(f"✓ {attr}:")
        print(f"    URL: /api/profiles/{url_path}/")
        print(f"    Methods: {obj.mapping}")
