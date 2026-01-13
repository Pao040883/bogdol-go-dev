import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

# Test 1: Einfache Suche
print("=" * 60)
print("TEST 1: 'blink'")
print("=" * 60)
results = search_profiles_semantic('blink', top_k=5)
print(f'Found {len(results)} results:\n')
for r in results:
    print(f'{r["profile"].user.get_full_name()}: score={r["score"]:.3f}')
    if r["matched_fields"]:
        for field_name, field_value in r["matched_fields"][:2]:
            print(f'  - {field_name}: {field_value[:60]}')
    print()

# Test 2: Mit Stopwords
print("\n" + "=" * 60)
print("TEST 2: 'wer macht blink'")
print("=" * 60)
results = search_profiles_semantic('wer macht blink', top_k=5)
print(f'Found {len(results)} results:\n')
for r in results:
    print(f'{r["profile"].user.get_full_name()}: score={r["score"]:.3f}')
    if r["matched_fields"]:
        for field_name, field_value in r["matched_fields"][:2]:
            print(f'  - {field_name}: {field_value[:60]}')
    print()

# Test 3: Mit vielen Stopwords
print("\n" + "=" * 60)
print("TEST 3: 'wo ist der drucker'")
print("=" * 60)
results = search_profiles_semantic('wo ist der drucker', top_k=5)
print(f'Found {len(results)} results:\n')
for r in results:
    print(f'{r["profile"].user.get_full_name()}: score={r["score"]:.3f}')
    if r["matched_fields"]:
        for field_name, field_value in r["matched_fields"][:2]:
            print(f'  - {field_name}: {field_value[:60]}')
    print()
