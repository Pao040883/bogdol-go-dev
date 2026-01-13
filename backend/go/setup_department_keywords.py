"""
Setup Department & Role Keywords für KI-Suche
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.profile_models import Department, DepartmentRole

def setup_keywords():
    """Fügt sinnvolle Keywords für Departments und Roles hinzu"""
    
    print("🔧 Setup Department & Role Keywords...\n")
    
    # Department-Keywords
    dept_keywords = {
        'IT': 'Computer, Laptop, Handy, Smartphone, Hardware, Software, Netzwerk, WLAN, Internet, Passwort, Drucker, Server, IT-Support, Technik, Reparatur, Installation, Email, Outlook',
        'Finanz': 'Rechnung, Zahlung, Buchhaltung, Gehalt, Lohn, Finanzen, Steuer, Kosten, Budget, Abrechnung, Bilanz, Controlling',
        'HR': 'Personal, Mitarbeiter, Bewerbung, Urlaub, Vertrag, Arbeitsvertrag, Onboarding, Kündigung, Gehaltsabrechnung, Fortbildung',
        'Verwaltung': 'Organisation, Büro, Verwaltung, Dokumente, Post, Archiv, Büromaterial, Bestellung',
        'Geschäftsführung': 'Leitung, Management, Strategie, Entscheidung, Führung, Geschäftsleitung',
        'Einkauf': 'Bestellung, Lieferant, Beschaffung, Einkauf, Material, Ware, Lieferung',
        'Vertrieb': 'Verkauf, Kunde, Angebot, Auftrag, Vertrieb, Sales, Akquise',
        'Marketing': 'Werbung, Marketing, Social Media, Website, Newsletter, PR, Öffentlichkeitsarbeit',
    }
    
    updated_depts = 0
    for dept in Department.objects.all():
        for keyword_key, keywords in dept_keywords.items():
            if keyword_key.lower() in dept.name.lower():
                dept.search_keywords = keywords
                dept.save()
                print(f"✅ Department '{dept.name}': {keywords[:50]}...")
                updated_depts += 1
                break
    
    # Role-Keywords
    role_keywords = {
        'Geschäftsführ': 'Geschäftsführung, Leitung, Management, Strategie, Entscheidung, Führung, Chef',
        'Abteilungsleiter': 'Leitung, Führung, Management, Team, Verantwortung, Koordination',
        'Mitarbeit': 'Team, Ausführung, Unterstützung, Arbeit, Aufgaben',
        'IT': 'Computer, Software, Hardware, Technik, Support, IT',
        'Finanz': 'Buchhaltung, Zahlen, Controlling, Finanzen, Rechnung',
        'Assistent': 'Unterstützung, Organisation, Koordination, Verwaltung, Assistenz',
    }
    
    updated_roles = 0
    for role in DepartmentRole.objects.all():
        for keyword_key, keywords in role_keywords.items():
            if keyword_key.lower() in role.name.lower():
                role.search_keywords = keywords
                role.save()
                print(f"✅ Role '{role.name}': {keywords[:50]}...")
                updated_roles += 1
                break
    
    print(f"\n📊 Summary:")
    print(f"   Departments updated: {updated_depts}")
    print(f"   Roles updated: {updated_roles}")

if __name__ == '__main__':
    setup_keywords()
    print("\n✨ Done! Keywords gesetzt.")
    print("\n💡 Tipp: Führe jetzt 'python manage.py shell' aus und:")
    print("   from auth_user.embedding_tasks import regenerate_all_embeddings_task")
    print("   regenerate_all_embeddings_task.delay()")
