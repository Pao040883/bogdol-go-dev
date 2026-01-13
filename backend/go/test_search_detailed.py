import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

# Test verschiedene Queries
queries = [
    "Hardware kaputt",
    "Drucker Problem",
    "Rechnung",
    "Management",
    "Marketing"
]

for query in queries:
    print(f'\n🔍 Suche: "{query}"')
    print('='*60)
    results = search_profiles_semantic(query, top_k=3)
    
    if not results:
        print('❌ Keine Ergebnisse')
        continue
    
    for i, r in enumerate(results, 1):
        print(f'\n{i}. {r["display_name"]} - {r["score"]:.1%}')
        if r['matched_fields']:
            for field, value in r['matched_fields']:
                print(f'   → {field}: {value[:60]}...' if len(value) > 60 else f'   → {field}: {value}')
        else:
            print(f'   Position: {r["profile"].job_title or "---"}')
            print(f'   Department: {r["profile"].department.name if r["profile"].department else "---"}')
