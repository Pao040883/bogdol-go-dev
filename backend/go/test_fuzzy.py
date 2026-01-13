import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

# Test mit Tippfehlern und mehreren Wörtern
test_queries = [
    "Handy kaputt",           # Mehrere Wörter
    "RECHNUNG PROBLEM",        # Großbuchstaben
    "drucker defekt",          # Kleinbuchstaben
    "Hardwre Reperatur",       # Tippfehler (Hardware Reparatur)
    "Managment Strategie",     # Tippfehler (Management)
    "Buchhaltng",              # Tippfehler (Buchhaltung)
    "IT Suport",               # Tippfehler (IT Support)
]

for query in test_queries:
    results = search_profiles_semantic(query, top_k=2)
    
    print(f'\n🔍 "{query}"')
    print('='*60)
    
    if not results:
        print('❌ Keine Ergebnisse')
        continue
    
    for i, r in enumerate(results, 1):
        print(f'{i}. {r["display_name"]}: {r["score"]:.1%}')
        if r['matched_fields']:
            for field, value in r['matched_fields'][:2]:  # Max 2 Fields
                preview = value[:40] + '...' if len(value) > 40 else value
                print(f'   → {field}: {preview}')
