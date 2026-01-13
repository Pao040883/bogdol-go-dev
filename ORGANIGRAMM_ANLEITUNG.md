# Organigramm füllen - Anleitung

Es gibt **3 Möglichkeiten**, Abteilungen und Teams für das Organigramm zu erstellen:

---

## ✅ Option 1: Frontend Admin-Panel (Empfohlen)

**Beste User Experience mit grafischer Oberfläche**

### Schritte:
1. Im Browser öffnen: `http://localhost:4200/admin`
2. Auf **"Abteilungen"** klicken
3. Auf **+** (Plus-Button) klicken
4. Formular ausfüllen:
   - **Name** (z.B. "Entwicklung")
   - **Code** (z.B. "DEV")
   - Beschreibung (optional)
   - Übergeordnete Abteilung (für Hierarchie)
   - Abteilungsleitung (User auswählen)
   - Status: Aktiv/Inaktiv
5. **Speichern** klicken

### Features:
- ✏️ Abteilungen bearbeiten
- 🗑️ Abteilungen löschen
- 🔍 Suchfunktion
- 📊 Mitarbeiterzahl anzeigen
- 🏗️ Hierarchie aufbauen (Parent-Department)

---

## Option 2: Django Admin (Backend)

**Für schnelle Bulk-Operationen**

### Schritte:
1. Im Browser öffnen: `http://localhost:8000/admin/`
2. Login mit Superuser-Account
3. Unter **"Auth_User"** → **"Departments"** klicken
4. **"Add Department"** klicken
5. Formular ausfüllen und speichern

### Superuser erstellen (falls noch nicht vorhanden):
```bash
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

---

## Option 3: API direkt (für Entwickler)

**Via REST API mit Tools wie Postman oder curl**

### Endpoint:
```
POST http://localhost:8000/api/departments/
```

### Headers:
```
Content-Type: application/json
Authorization: Bearer <dein-token>
```

### Body (Beispiel):
```json
{
  "name": "Entwicklung",
  "code": "DEV",
  "description": "Software-Entwicklungsabteilung",
  "parent": null,
  "head": 1,
  "is_active": true
}
```

### Weitere Endpoints:
- `GET /api/departments/` - Alle Abteilungen
- `GET /api/departments/tree/` - Hierarchischer Baum
- `PUT /api/departments/{id}/` - Abteilung ändern
- `DELETE /api/departments/{id}/` - Abteilung löschen
- `GET /api/departments/{id}/members/` - Mitarbeiter

---

## Beispiel-Struktur

Hier ein Beispiel, wie du eine Hierarchie aufbauen kannst:

```
Geschäftsführung (GF)
├── IT (IT)
│   ├── Entwicklung (DEV)
│   ├── Support (SUP)
│   └── DevOps (OPS)
├── Vertrieb (VTR)
│   ├── Innendienst (INN)
│   └── Außendienst (AUS)
└── Verwaltung (VER)
    ├── Buchhaltung (BUH)
    └── Personal (PER)
```

### Reihenfolge:
1. **Hauptabteilungen** erstellen (ohne Parent):
   - Geschäftsführung
   - IT
   - Vertrieb
   - Verwaltung

2. **Unterabteilungen** erstellen (mit Parent):
   - Entwicklung → Parent: IT
   - Support → Parent: IT
   - etc.

---

## Benutzer zu Abteilungen zuordnen

### Im Frontend (Admin → Benutzer):
1. Gehe zu `/admin/users`
2. Benutzer bearbeiten
3. Unter **"Organigramm"** → Abteilung auswählen
4. Speichern

### Im Django Admin:
1. `http://localhost:8000/admin/`
2. **Users** → Benutzer auswählen
3. **Profile** bearbeiten
4. Department auswählen
5. Speichern

---

## Tipps

✅ **Hierarchie aufbauen**: Verwende "Übergeordnete Abteilung" für mehrstufige Strukturen  
✅ **Abteilungsleitung**: Weise jedem Department einen Head zu  
✅ **Eindeutige Codes**: Verwende kurze, eindeutige Codes (z.B. DEV, HR, FIN)  
✅ **Status**: Nur aktive Abteilungen werden im Organigramm angezeigt  

---

## Ansicht im Frontend

Nach dem Erstellen kannst du das Organigramm hier ansehen:

📍 **Dashboard** → **Organigramm**  
📍 Direkt: `http://localhost:4200/intranet/organigramm`

### Features:
- 🌳 **Hierarchie-Ansicht**: Expandierbare Baumstruktur
- 📋 **Listen-Ansicht**: Alle Abteilungen als Liste
- 👥 **Mitarbeiter**: Klick auf Abteilung zeigt alle Mitglieder
- 💬 **Chat starten**: Direkt mit Mitarbeitern chatten
- 👤 **Profil öffnen**: Zu Mitarbeiter-Profilen navigieren

---

## Berechtigungen

⚠️ **Wichtig**: 
- Abteilungen **erstellen/ändern/löschen** können nur **Staff-User** (is_staff=True)
- Normale User können das Organigramm nur **ansehen**
- Admin-Panel ist nur für Staff-User zugänglich

### Staff-Status vergeben:
```bash
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
```

```python
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='deinusername')
user.is_staff = True
user.save()
```
