import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

test_queries = [
    "blink",
    "blink it",
    "IT blink",
]

for query in test_queries:
    results = search_profiles_semantic(query, top_k=3)
    
    print(f'\n🔍 "{query}" - {len(results)} Ergebnisse')
    print('='*60)
    
    if not results:
        print('❌ Keine Ergebnisse (unter 20% Threshold)')
        continue
    
    for i, r in enumerate(results, 1):
        print(f'{i}. {r["display_name"]}: {r["score"]:.1%}')
        if r['matched_fields']:
            for field, value in r['matched_fields'][:2]:
                preview = value[:50] + '...' if len(value) > 50 else value
                print(f'   → {field}: {preview}')
