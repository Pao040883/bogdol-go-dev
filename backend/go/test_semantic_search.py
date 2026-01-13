"""
KI-Suche Tester - Interaktiv
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_service import search_profiles_semantic

def test_search():
    """Interaktiver Test der semantischen Suche"""
    
    print("=" * 60)
    print("🤖 KI-SUCHE TESTER")
    print("=" * 60)
    print("\nBeispiel-Queries:")
    print("  - Handy kaputt")
    print("  - Frage zur Rechnung")
    print("  - Computer Problem")
    print("  - Wer ist Geschäftsführer?")
    print("  - IT Support")
    print("\nTippe 'exit' zum Beenden\n")
    
    while True:
        query = input("🔍 Suche: ").strip()
        
        if query.lower() in ['exit', 'quit', 'q']:
            print("\n👋 Bis bald!")
            break
        
        if not query:
            continue
        
        print(f"\n⏳ Suche nach: '{query}'...\n")
        
        results = search_profiles_semantic(query, top_k=5)
        
        if not results:
            print("❌ Keine Ergebnisse gefunden")
            print("💡 Tipp: Embeddings neu generieren mit regenerate_embeddings.py\n")
            continue
        
        print(f"✅ {len(results)} Ergebnisse:\n")
        
        for i, result in enumerate(results, 1):
            print(f"{i}. {result['display_name']}")
            print(f"   Score: {result['score']*100:.1f}%")
            
            if result['matched_fields']:
                print(f"   Gefunden in:")
                for field_name, field_value in result['matched_fields'][:2]:
                    value_short = field_value[:60] + "..." if len(field_value) > 60 else field_value
                    print(f"     - {field_name}: {value_short}")
            
            profile = result['profile']
            if profile.job_title:
                print(f"   Position: {profile.job_title}")
            if profile.department:
                print(f"   Abteilung: {profile.department.name}")
            
            print()
        
        print("-" * 60)
        print()

if __name__ == '__main__':
    try:
        test_search()
    except KeyboardInterrupt:
        print("\n\n👋 Beendet durch Benutzer")
