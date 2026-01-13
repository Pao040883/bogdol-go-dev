# Contacts Module - Internes Mitarbeiterverzeichnis

## Übersicht
Das Contacts-Modul verwaltet erweiterte Kontaktinformationen für interne Mitarbeiter. Es ist direkt mit dem User-Model verknüpft (One-to-One) und dient als internes Mitarbeiterverzeichnis.

## Model: ContactProfile

### Automatische Erstellung
- Jeder neue User erhält automatisch ein ContactProfile (via Signal)
- Für bestehende User wurde das Profil bereits erstellt

### Felder

#### Kontaktinformationen
- `work_extension` - Durchwahl (z.B. "123" oder "-123")
- `private_phone` - Private Telefonnummer
- `preferred_contact_method` - Bevorzugte Kontaktmethode (email/phone/mobile/teams)

#### Notfallkontakt
- `emergency_contact_name` - Name des Notfallkontakts
- `emergency_contact_phone` - Telefonnummer Notfallkontakt
- `emergency_contact_relation` - Beziehung (z.B. Ehepartner, Eltern)

#### Standort & Arbeitsplatz
- `office_location` - Bürostandort (z.B. "Hamburg HQ", "Home Office")
- `desk_number` - Schreibtisch-/Raumnummer
- `typical_work_hours` - Typische Arbeitszeiten (z.B. "Mo-Fr 8:00-16:30")
- `timezone` - Zeitzone (default: "Europe/Berlin")

#### Collaboration Tools
- `teams_id` - Microsoft Teams ID
- `slack_id` - Slack ID

#### Sonstiges
- `notes` - Interne Notizen (nur HR/Admin)
- `is_visible_in_directory` - Sichtbarkeit im Verzeichnis (default: True)

## API Endpoints

### Base URL: `/api/contacts/`

#### 1. Liste aller Kontakte
```
GET /api/contacts/
```
**Zugriff:**
- Normale User: Nur sichtbare & aktive Profile
- Admins/HR: Alle Profile

**Filter:**
- `?office_location=Hamburg`
- `?user__department=IT`
- `?preferred_contact_method=email`
- `?search=Offermanns` (sucht in Name, Email, Abteilung, etc.)

**Sortierung:**
- `?ordering=user__last_name`
- `?ordering=-office_location`

#### 2. Einzelnes Profil
```
GET /api/contacts/{user_id}/
```

#### 3. Vereinfachtes Verzeichnis
```
GET /api/contacts/directory/
```
Zeigt nur öffentliche Informationen (keine sensiblen Daten wie Notfallkontakte oder Notizen)

#### 4. Eigenes Profil
```
GET /api/contacts/my_profile/
PUT /api/contacts/my_profile/
PATCH /api/contacts/my_profile/
```
User können ihre eigenen Kontaktdaten aktualisieren (eingeschränkt auf nicht-sensible Felder)

**Erlaubte Felder für User-Updates:**
- work_extension
- preferred_contact_method
- teams_id
- slack_id
- typical_work_hours
- office_location
- desk_number

#### 5. Nach Abteilung gruppiert
```
GET /api/contacts/by_department/
```
Gibt Kontakte gruppiert nach Abteilungen zurück

## Admin Interface

Verfügbar unter `/admin/contacts/contactprofile/`

**Features:**
- Suche nach Name, Email, Standort
- Filter nach Abteilung, Standort, Sichtbarkeit
- Gruppierte Feldsets (Notfallkontakt ist eingeklappt)
- Übersichtliche Listenansicht

## Verwendung im Code

### ContactProfile für User abrufen
```python
from contacts.models import ContactProfile

# Via related_name
contact = user.contact_profile

# Oder direkter Zugriff
contact = ContactProfile.objects.get(user=user)
```

### Hilfsmethoden
```python
# Vollständige Telefonnummer mit Durchwahl
full_phone = contact.get_full_phone_number()

# Primäre Kontaktmethode
primary = contact.get_primary_contact()

# Notfallkontakt vorhanden?
if contact.has_emergency_contact:
    print(f"Notfall: {contact.emergency_contact_name}")

# Abteilung + Standort kombiniert
location = contact.department_display
```

## Performance

### Optimierungen
- Indizes auf `office_location + is_visible_in_directory`
- Indizes auf `is_visible_in_directory + user`
- `select_related('user')` in allen Queries
- Telefonnummer-Validierung auf Model-Ebene

### Datenbank
- One-to-One Beziehung mit CustomUser (keine Redundanz)
- Automatische Erstellung via Signals
- Optimierte Queries mit prefetching

## Typische Use Cases

### 1. Mitarbeiterverzeichnis anzeigen
```python
# Alle sichtbaren Kontakte
contacts = ContactProfile.objects.filter(
    is_visible_in_directory=True,
    user__is_active=True
).select_related('user')
```

### 2. Nach Standort filtern
```python
hamburg_team = ContactProfile.objects.filter(
    office_location__icontains='Hamburg'
).select_related('user')
```

### 3. IT-Abteilung finden
```python
it_contacts = ContactProfile.objects.filter(
    user__department='IT'
).select_related('user')
```

### 4. Notfallkontakte für Abteilung
```python
contacts_with_emergency = ContactProfile.objects.filter(
    user__department='Außendienst',
    emergency_contact_name__isnull=False
).select_related('user')
```

## Berechtigungen

### Normale User
- Sehen nur sichtbare, aktive Profile
- Können nur ihr eigenes Profil bearbeiten (eingeschränkte Felder)
- Kein Zugriff auf Notizen anderer User

### HR / Admins
- Sehen alle Profile (auch inaktive)
- Können alle Felder bearbeiten
- Zugriff auf sensible Daten (Notfallkontakte, Notizen)

## Signals

### post_save auf CustomUser
Erstellt automatisch ein ContactProfile für jeden neuen User.

## Migration

Alle bestehenden User haben jetzt ein ContactProfile. Bei Bedarf können zusätzliche Informationen über das Admin-Interface oder API hinzugefügt werden.
