import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

query = "Drucker Problem"
results = search_profiles_semantic(query, top_k=5)

print(f'\n🔍 "{query}" - {len(results)} Ergebnisse:\n')
for r in results:
    print(f'{r["display_name"]}: {r["score"]:.1%}')
    if r['matched_fields']:
        for field, value in r['matched_fields']:
            print(f'  → {field}: {value[:50]}...' if len(value) > 50 else f'  → {field}: {value}')
