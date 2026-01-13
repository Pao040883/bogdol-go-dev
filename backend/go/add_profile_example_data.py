"""
Beispiel-Daten für User-Profile (KI-Suche)
Fügt responsibilities und expertise_areas hinzu
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.models import UserProfile, CustomUser

def add_example_data():
    """Fügt Beispieldaten für KI-Suche hinzu"""
    
    print("📝 Füge Beispieldaten für User-Profile hinzu...\n")
    
    # Beispiele für verschiedene Rollen/Abteilungen
    examples = {
        'IT': {
            'responsibilities': 'IT-Support, Hardware-Reparatur, Netzwerk-Administration, Software-Installation, Helpdesk, Computer-Probleme lösen',
            'expertise_areas': 'Windows, Linux, Netzwerke, Hardware, Server, Drucker, WLAN-Probleme'
        },
        'Finanz': {
            'responsibilities': 'Rechnungsstellung, Zahlungsverkehr, Buchhaltung, Gehaltsabrechnung, Finanz-Controlling',
            'expertise_areas': 'SAP, DATEV, Buchhaltung, Steuern, Bilanzierung'
        },
        'Geschäftsführ': {
            'responsibilities': 'Strategische Planung, Unternehmensführung, Personalentscheidungen, Budgetverantwortung',
            'expertise_areas': 'Management, Strategie, Führung, Vertragsverhandlung'
        },
        'Personal': {
            'responsibilities': 'Personalverwaltung, Bewerbungsprozess, Vertragsmanagement, Urlaubs- und Fehlzeitenverwaltung',
            'expertise_areas': 'HR, Arbeitsrecht, Recruiting, Personalentwicklung'
        },
    }
    
    updated = 0
    for profile in UserProfile.objects.select_related('user', 'department', 'role').all():
        # Skip wenn schon Daten vorhanden
        if profile.responsibilities and profile.expertise_areas:
            print(f"⏭️  {profile.display_name}: Already has data")
            continue
        
        # Versuche Match über Department oder Role
        matched = False
        for keyword, data in examples.items():
            dept_match = profile.department and keyword.lower() in profile.department.name.lower()
            role_match = profile.role and keyword.lower() in profile.role.name.lower()
            job_match = profile.job_title and keyword.lower() in profile.job_title.lower()
            
            if dept_match or role_match or job_match:
                profile.responsibilities = data['responsibilities']
                profile.expertise_areas = data['expertise_areas']
                profile.save()
                print(f"✅ {profile.display_name}: {data['responsibilities'][:50]}...")
                updated += 1
                matched = True
                break
        
        if not matched and profile.job_title:
            # Generische Daten basierend auf Job-Titel
            profile.responsibilities = f"{profile.job_title}, Team-Zusammenarbeit, Projektunterstützung"
            profile.expertise_areas = f"{profile.job_title}"
            profile.save()
            print(f"✅ {profile.display_name}: Generic data from job title")
            updated += 1
    
    print(f"\n📊 Summary: {updated} Profile aktualisiert")

if __name__ == '__main__':
    add_example_data()
    print("\n✨ Done!")
    print("\n💡 Nächster Schritt: Embeddings neu generieren")
    print("   docker exec bogdol_go_backend_dev python regenerate_embeddings.py")
