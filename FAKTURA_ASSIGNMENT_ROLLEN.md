# Faktura-Zuweisungssystem - Dokumentation

## Überblick

Das Faktura-Zuweisungssystem ermöglicht es Faktura-Mitarbeitern, bestimmten Mitarbeitern Arbeitsscheine zuzuweisen. Die Zuweisung ist **rollenbasiert** und flexibel konfigurierbar.

## Architektur

### 1. Rollenbasierte Filterung

**DepartmentRole.can_receive_faktura_assignments**
- Boolean-Feld im `DepartmentRole` Model
- Definiert, ob Mitarbeiter mit dieser Rolle Faktura-Zuweisungen erhalten können
- Standard: `False` (nur explizit aktivierte Rollen)
- Beispiel: Service Manager (SM) haben das Flag aktiviert

### 2. Backend-Implementierung

**Endpoint:** `GET /api/faktura/assignments/employees/`

```python
# Filtert automatisch nur User mit Rollen, die das Flag haben:
assignable_user_ids = DepartmentMember.objects.filter(
    is_active=True,
    role__can_receive_faktura_assignments=True,
    role__is_active=True
).values_list('user_id', flat=True).distinct()
```

**Response:**
```json
[
  {
    "id": 123,
    "username": "max.mustermann",
    "name": "Max Mustermann",
    "department": {
      "id": 5,
      "name": "Service"
    },
    "roles": [
      {
        "id": 3,
        "name": "Service Manager"
      }
    ]
  }
]
```

### 3. Frontend-Integration

**Service:** `FakturaAssignmentService`
```typescript
interface FakturaEmployee {
  id: number;
  username: string;
  name: string;
  department?: { id: number; name: string };
  roles?: Array<{ id: number; name: string }>;
}

// Lädt nur zuweisbare Mitarbeiter
await getFakturaEmployees()
```

## Konfiguration

### Neue Rolle als zuweisbar markieren

**Option 1: Admin-Interface**
1. Gehe zu `/admin/auth_user/departmentrole/`
2. Wähle die Rolle aus (z.B. "Service Manager")
3. Aktiviere "Kann Faktura-Zuweisungen erhalten"
4. Speichern

**Option 2: Python-Script**
```python
# backend/go/setup_faktura_assignable_roles.py
assignable_role_codes = [
    'SM',   # Service Manager
    'TL',   # Team Leader (Beispiel)
]
```

Script ausführen:
```bash
docker exec bogdol_go_backend_dev python setup_faktura_assignable_roles.py
```

**Option 3: Django Shell**
```python
from auth_user.profile_models import DepartmentRole

# Einzelne Rolle
role = DepartmentRole.objects.get(code='SM')
role.can_receive_faktura_assignments = True
role.save()

# Mehrere Rollen
DepartmentRole.objects.filter(
    code__in=['SM', 'TL']
).update(can_receive_faktura_assignments=True)
```

## Verwendung

### Faktura-Mitarbeiter Workflow

1. **Öffne Arbeitsscheine-Seite** → Klick auf "Service Manager zuweisen"
2. **Modal öffnet sich** → Zeigt nur Mitarbeiter mit zuweisbaren Rollen
3. **Wähle Mitarbeiter** → System filtert automatisch nach Rolle
4. **Speichere Zuweisung** → Mitarbeiter erhält Benachrichtigung

### Berechtigungen

- **Zugriff auf Modal:** Gruppe "Faktura" oder `is_staff=True`
- **Anzeige in Liste:** `can_receive_faktura_assignments=True` in zugeordneter Rolle
- **Mehrere Rollen:** User wird angezeigt, wenn EINE Rolle das Flag hat

## Migration

**Erstellt:** `0033_add_faktura_assignment_flag.py`

```python
# Fügt Feld hinzu:
field = models.BooleanField(
    'Kann Faktura-Zuweisungen erhalten',
    default=False,
    help_text='Mitarbeiter mit dieser Rolle können von Faktura-Mitarbeitern zugewiesen werden'
)
```

**Rückwärtskompatibel:** Ja - Default `False` bedeutet keine Änderung im Verhalten

## Vorteile dieser Lösung

✅ **Flexibel:** Admin kann beliebige Rollen als zuweisbar markieren
✅ **Zentral:** Konfiguration direkt im Rollen-Model
✅ **Sicher:** Nur explizit aktivierte Rollen werden angezeigt
✅ **Skalierbar:** Neue Rollen einfach hinzufügbar
✅ **Transparent:** Im Admin-Interface sofort sichtbar

## Beispiel-Szenarien

### Szenario 1: Service Manager
```
Rolle: Service Manager (SM)
Flag: can_receive_faktura_assignments = True
Ergebnis: Alle Service Manager erscheinen in Faktura-Zuweisung
```

### Szenario 2: Team Leader hinzufügen
```python
# 1. Rolle erstellen (falls nicht vorhanden)
role = DepartmentRole.objects.create(
    name='Team Leader',
    code='TL',
    hierarchy_level=4,
    can_receive_faktura_assignments=True
)

# 2. Mitarbeiter zuordnen
DepartmentMember.objects.create(
    user=user,
    department=department,
    role=role,
    is_active=True
)

# 3. Sofort in Faktura-Zuweisung verfügbar!
```

### Szenario 3: Rolle deaktivieren
```python
# Keine Service Manager mehr zuweisbar
role = DepartmentRole.objects.get(code='SM')
role.can_receive_faktura_assignments = False
role.save()
# → Alle SM verschwinden aus der Liste
```

## Troubleshooting

**Problem:** Mitarbeiter erscheint nicht in Liste
- ✓ Hat User eine aktive DepartmentMember-Zuordnung?
- ✓ Ist die Rolle aktiv (`is_active=True`)?
- ✓ Hat die Rolle `can_receive_faktura_assignments=True`?
- ✓ Ist die DepartmentMember-Zuordnung aktiv?

**Problem:** Liste ist leer
```python
# Prüfe zuweisbare Rollen
from auth_user.profile_models import DepartmentRole
DepartmentRole.objects.filter(
    can_receive_faktura_assignments=True,
    is_active=True
).values('name', 'code')
```

**Problem:** Zu viele Mitarbeiter in Liste
```python
# Prüfe welche Rollen das Flag haben
DepartmentRole.objects.filter(
    can_receive_faktura_assignments=True
).values('name', 'code', 'member_count')
```

## API-Referenz

**Endpoint:** `GET /api/faktura/assignments/employees/`
- **Auth:** Gruppe "Faktura" oder `is_staff=True`
- **Response:** Array von `FakturaEmployee`
- **Filter:** Automatisch nach `can_receive_faktura_assignments`
- **Sortierung:** Nach Username

**Verwandte Endpoints:**
- `GET /api/faktura/assignments/my/` - Eigene Zuweisungen
- `POST /api/faktura/assignments/` - Neue Zuweisung erstellen
- `DELETE /api/faktura/assignments/{id}/` - Zuweisung löschen
- `GET /api/org-roles/` - Alle Rollen (inkl. Flag)
