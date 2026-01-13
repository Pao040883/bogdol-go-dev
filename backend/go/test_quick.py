import os
import time
import django

# 5 Sekunden warten für Celery
time.sleep(5)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

# Test
results = search_profiles_semantic('Rechnung', top_k=3)
print(f'\n✅ Gefunden: {len(results)} Ergebnisse')
for r in results:
    print(f"  - {r['display_name']}: {r['score']:.2%}")
    if r['matched_fields']:
        print(f"    → {r['matched_fields'][0][0]}: {r['matched_fields'][0][1][:50]}...")
