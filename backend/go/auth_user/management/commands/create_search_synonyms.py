"""
Management Command: Erstelle Standard-Synonyme für bessere Suche
"""
from django.core.management.base import BaseCommand
from auth_user.search_models import SearchSynonym


class Command(BaseCommand):
    help = 'Erstellt Standard-Synonym-Mappings für häufige Such-Begriffe'
    
    def handle(self, *args, **options):
        synonyms_data = [
            # Hierarchie & Führung
            ('chef', 'geschäftsführer, leitung, gf, direktor, vorgesetzter, führungskraft', 1.0, ''),
            ('geschäftsführer', 'chef, gf, direktor, leitung, führung', 1.0, ''),
            ('leiter', 'manager, führungskraft, vorgesetzter, chef, teamlead', 0.9, ''),
            ('manager', 'leiter, führungskraft, projektleiter', 0.9, ''),
            
            # IT-Begriffe
            ('it', 'informationstechnik, edv, computer, technik', 0.95, 'IT'),
            ('edv', 'it, informationstechnik, computer', 0.95, 'IT'),
            ('computer', 'pc, rechner, laptop, notebook', 0.9, 'IT'),
            ('drucker', 'printer, druckgerät, druckersystem', 0.95, 'IT'),
            ('netzwerk', 'lan, wlan, wifi, internet, router, switch', 0.9, 'IT'),
            ('server', 'datenbank, host, backend', 0.85, 'IT'),
            ('software', 'programm, anwendung, app, application', 0.9, 'IT'),
            ('hardware', 'gerät, technik, komponente', 0.85, 'IT'),
            
            # Verwaltung
            ('verwaltung', 'administration, büro, office', 0.9, 'Verwaltung'),
            ('büro', 'office, verwaltung, sekretariat', 0.9, 'Verwaltung'),
            ('sekretariat', 'büro, assistenz, office', 0.9, 'Verwaltung'),
            
            # Finanzen
            ('buchhaltung', 'finanzen, rechnungswesen, controlling', 0.95, 'Verwaltung'),
            ('faktura', 'fakturierung, rechnungsstellung, abrechnung', 0.95, 'Verwaltung'),
            ('rechnung', 'invoice, faktura, abrechnung', 0.9, 'Verwaltung'),
            
            # Personal
            ('personal', 'hr, human resources, personalwesen', 0.95, 'Verwaltung'),
            ('hr', 'personal, human resources, personalwesen', 0.95, 'Verwaltung'),
            ('mitarbeiter', 'angestellter, kollege, beschäftigter', 0.85, ''),
            
            # Projekte
            ('projekt', 'vorhaben, initiative, aufgabe', 0.85, ''),
            ('planung', 'koordination, organisation, disposition', 0.85, ''),
            
            # Support
            ('support', 'hilfe, unterstützung, betreuung, service', 0.9, 'IT'),
            ('hilfe', 'support, unterstützung, assistance', 0.9, ''),
            ('problem', 'fehler, issue, störung, bug', 0.85, ''),
            
            # Kommunikation
            ('telefon', 'phone, anruf, telefonat, tel', 0.9, ''),
            ('email', 'mail, e-mail, nachricht, post', 0.95, ''),
            ('kontakt', 'ansprechpartner, verbindung, kontaktperson', 0.9, ''),
        ]
        
        created_count = 0
        updated_count = 0
        
        for term, synonyms, weight, scope in synonyms_data:
            obj, created = SearchSynonym.objects.update_or_create(
                term=term,
                defaults={
                    'synonyms': synonyms,
                    'weight': weight,
                    'scope': scope,
                    'is_auto_generated': False,
                    'is_active': True
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✅ Created: {term}'))
            else:
                updated_count += 1
                self.stdout.write(f'Updated: {term}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Fertig! {created_count} erstellt, {updated_count} aktualisiert'
            )
        )
