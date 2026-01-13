import os, sys, django
sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic
from django.contrib.auth import get_user_model

user = get_user_model().objects.first()
results = search_profiles_semantic('dynamics', user=user, top_k=5)

print(f'\n{len(results)} Ergebnisse für "dynamics":')
for i, r in enumerate(results):
    print(f'  {i+1}. {r["profile"].user.get_full_name()} - Score: {r["score"]:.3f}')
