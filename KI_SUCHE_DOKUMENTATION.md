# 🤖 KI-gestützte Mitarbeitersuche - Dokumentation

## ✨ Features

### 1. **Intelligente Suche**
Benutzer können in natürlicher Sprache suchen:
- ❌ Nicht mehr: "Patrick Offermanns"
- ✅ Jetzt: "Handy kaputt", "Frage zur Rechnung", "IT-Problem"

### 2. **Lokale KI - Keine externen APIs!**
- **Sentence Transformers** (all-MiniLM-L6-v2)
- Komplett auf dem Server
- DSGVO-konform
- Keine Kosten für API-Calls

### 3. **Relevanz-Scores**
- Zeigt wie relevant ein Treffer ist (0-100%)
- "Warum dieser Treffer?" - zeigt matched fields

### 4. **Hybrid-Suche**
- Keyword-Matching (schnell)
- Semantic Embedding Search (intelligent)
- Kombiniert für beste Ergebnisse

## 🎯 Wie es funktioniert

### Backend

**1. Daten-Anreicherung:**
```python
# User-Profil
responsibilities = "IT-Support, Hardware-Reparatur, Netzwerk..."
expertise_areas = "Windows, Linux, Server, Drucker..."

# Department
search_keywords = "Computer, Handy, IT, Hardware..."

# Role
search_keywords = "Support, Technik, Reparatur..."
```

**2. Embedding-Generierung:**
```python
# Kombiniert alle relevanten Felder
text = f"Name: {name} | Position: {job_title} | Abteilung: {dept} | 
         Bereich: {dept_keywords} | Aufgaben: {role_keywords} | 
         Verantwortung: {responsibilities} | Expertise: {expertise}"

# Generiert 384-dimensionalen Vektor
embedding = model.encode(text)  # [0.123, -0.456, ...]
```

**3. Suche:**
```python
# Query wird zu Vektor
query_vector = model.encode("Handy kaputt")

# Cosine Similarity mit allen Profilen
for profile in profiles:
    similarity = cosine_similarity(query_vector, profile.embedding)
    
# Sortiert nach Relevanz
results.sort(by='similarity', reverse=True)
```

### Frontend

**Toggle zwischen Modi:**
- 🔍 **Text-Suche**: Klassisch nach Namen/Abteilung
- ✨ **KI-Suche**: Semantisch nach Kontext

**UI-Features:**
- Relevanz-Score Anzeige
- Matched Fields ("Gefunden in: IT-Bereich")
- Warning-Banner wenn KI aktiv

## 📊 Datenstruktur

### UserProfile (erweitert)
```typescript
{
  responsibilities: string;  // "IT-Support, Hardware..."
  expertise_areas: string;   // "Windows, Linux..."
  embedding_vector: string;  // JSON Array [0.1, 0.2, ...]
}
```

### Department (erweitert)
```typescript
{
  search_keywords: string;  // "Computer, Handy, IT..."
}
```

### DepartmentRole (erweitert)
```typescript
{
  search_keywords: string;  // "Support, Technik..."
}
```

### Search Response
```typescript
{
  // Standard User-Daten
  id, name, email, department...
  
  // KI-Zusatzdaten
  relevance_score: 0.847,  // 84.7% Relevanz
  matched_fields: [
    ["Bereich", "IT, Computer, Hardware"],
    ["Expertise", "Windows, Drucker"]
  ]
}
```

## 🚀 API-Endpunkte

### Semantische Suche
```http
GET /api/profiles/search/?q=Handy kaputt&semantic=true
```

**Response:**
```json
[
  {
    "id": 3,
    "full_name": "Patrick Offermanns",
    "job_title": "Abteilungsleiter",
    "department_name": "IT",
    "relevance_score": 0.847,
    "matched_fields": [
      ["Bereich", "Computer, Handy, Hardware"],
      ["Verantwortung", "IT-Support, Hardware-Reparatur"]
    ]
  }
]
```

### Normale Suche
```http
GET /api/profiles/search/?q=Patrick
```

## 🛠️ Setup & Maintenance

### 1. Keywords setzen
```bash
docker exec bogdol_go_backend_dev python setup_department_keywords.py
```

### 2. Beispieldaten hinzufügen
```bash
docker exec bogdol_go_backend_dev python add_profile_example_data.py
```

### 3. Embeddings generieren
```bash
docker exec bogdol_go_backend_dev python regenerate_embeddings.py
```

### 4. Automatisch bei User-Änderung
Embeddings werden automatisch neu generiert wenn:
- User-Profil aktualisiert wird
- Department/Role geändert wird
- Via Celery im Hintergrund

## 🎨 Frontend-Nutzung

### Service verwenden
```typescript
import { UserPhonebookService } from '@services/user-phonebook.service';

// KI-Suche
userService.searchSemantic('Handy kaputt').subscribe(results => {
  console.log(results[0].relevance_score);  // 0.847
  console.log(results[0].matched_fields);    // [["Bereich", "IT..."]]
});

// Toggle
userService.toggleSemanticSearch();
```

### In Komponente
```typescript
@Component({...})
export class ContactsListPage {
  searchMode = signal<'normal' | 'semantic'>('semantic');
  
  handleSearch(query: string) {
    if (this.searchMode() === 'semantic') {
      this.userService.searchSemantic(query).subscribe(...);
    } else {
      // Normale Suche
    }
  }
}
```

## 💡 Best Practices

### Für Admins

**1. Department-Keywords pflegen:**
```
IT: Computer, Laptop, Handy, Smartphone, Hardware, Software, Netzwerk, 
    WLAN, Internet, Passwort, Drucker, Server, IT-Support, Technik
```

**2. User-Profile ausfüllen:**
```
Responsibilities: IT-Support, Hardware-Reparatur, Netzwerk-Administration
Expertise: Windows, Linux, Server, Drucker, WLAN-Probleme
```

**3. Regelmäßig Embeddings neu generieren:**
- Bei großen Datenänderungen
- Alle paar Wochen als Wartung

### Für Entwickler

**Testing:**
```bash
# Backend testen
docker exec bogdol_go_backend_dev python test_embeddings.py

# Manuelle Suche testen
curl "http://localhost:8000/api/profiles/search/?q=Handy%20kaputt&semantic=true"
```

**Performance:**
- Embeddings werden gecached (JSONField)
- Suche ist < 100ms
- Async via Celery für Generierung

## 🔮 Zukünftige Erweiterungen

1. **Multi-Language Support**
   - Deutsch + Englisch
   - Modell: `paraphrase-multilingual-MiniLM-L12-v2`

2. **Personalisierte Suche**
   - User-History
   - Häufige Kontakte bevorzugen

3. **Chatbot-Integration**
   - "Wer kann mir bei X helfen?"
   - Direkte Nachricht an Top-Treffer

4. **Admin-Dashboard**
   - Häufigste Suchanfragen
   - Schlecht gefundene Queries
   - Verbesserungsvorschläge

## 🐛 Troubleshooting

### "Keine Ergebnisse"
```bash
# 1. Check Embeddings
docker exec bogdol_go_backend_dev python manage.py shell
>>> from auth_user.models import UserProfile
>>> UserProfile.objects.filter(embedding_vector__isnull=False).count()

# 2. Neu generieren
docker exec bogdol_go_backend_dev python regenerate_embeddings.py

# 3. Celery logs checken
docker logs bogdol_go_celery
```

### "Schlechte Treffer"
- Keywords in Department/Role erweitern
- User responsibilities detaillierter ausfüllen
- Embeddings neu generieren

### "Zu langsam"
- Redis für Caching nutzen
- Anzahl profiles reduzieren (is_searchable=False)
- Parallel processing in Celery

## 📚 Weiterführende Infos

- **Sentence Transformers**: https://www.sbert.net/
- **Cosine Similarity**: https://en.wikipedia.org/wiki/Cosine_similarity
- **Model Card**: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
