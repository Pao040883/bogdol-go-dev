# Permission Scope System - Dokumentation

## Übersicht

Das Berechtigungssystem wurde um ein **Scope-System** erweitert, das zwischen verschiedenen Geltungsbereichen unterscheidet:

- **NONE**: Keine Einschränkung (z.B. für App-Zugriff)
- **OWN**: Nur eigene Objekte (z.B. eigene Arbeitsscheine)
- **DEPARTMENT**: Objekte der eigenen Abteilung
- **ALL**: Alle Objekte im System

## Änderungen am Datenmodell

### PermissionCode (Backend)

**Neue Felder:**
```python
supports_scope = models.BooleanField(
    'Unterstützt Scope',
    default=False,
    help_text='Kann diese Permission unterschiedliche Scopes haben?'
)

default_scope = models.CharField(
    'Standard-Scope',
    max_length=20,
    choices=SCOPE_CHOICES,
    default='NONE',
    help_text='Standard-Geltungsbereich dieser Permission'
)
```

**Scope-Choices:**
- `NONE` - Keine Einschränkung
- `OWN` - Nur eigene
- `DEPARTMENT` - Eigene Abteilung  
- `ALL` - Alle

### PermissionMapping (Backend)

**Neues Feld:**
```python
scope = models.CharField(
    'Geltungsbereich',
    max_length=20,
    choices=PermissionCode.SCOPE_CHOICES,
    null=True,
    blank=True,
    help_text='Überschreibt den Standard-Scope'
)
```

**Neue Methode:**
```python
def get_effective_scope(self):
    """Gibt den effektiven Scope zurück (mapping.scope oder permission.default_scope)"""
    return self.scope if self.scope else self.permission.default_scope
```

## Permissions mit Scope-Unterstützung

### Arbeitsscheine
- `can_view_workorders` - Default: **OWN**
- `can_edit_workorders` - Default: **OWN**
- `can_download_workorder_pdf` - Default: **OWN**
- `can_cancel_workorder` - Default: **OWN**

### Abwesenheiten
- `can_view_absences` - Default: **OWN**
- `can_approve_absences` - Default: **DEPARTMENT**
- `can_manage_absences` - Default: **ALL** (HR)

## Backend API

### PermissionService - Neue Methoden

#### `get_permission_scope(permission_code)`
Gibt den effektiven Scope einer Permission zurück:
```python
perm_service = PermissionService.for_user(user)
scope = perm_service.get_permission_scope('can_view_workorders')
# Returns: 'OWN' | 'DEPARTMENT' | 'ALL' | 'NONE' | None
```

#### `has_scope(permission_code, required_scope)`
Prüft ob User mindestens den geforderten Scope hat:
```python
# Prüft ob User ALLE Arbeitsscheine sehen darf
has_all = perm_service.has_scope('can_view_workorders', 'ALL')

# Prüft ob User mindestens Abteilungs-Arbeitsscheine sehen darf
has_dept = perm_service.has_scope('can_view_workorders', 'DEPARTMENT')
```

**Scope-Hierarchie:**
- `ALL` ≥ `DEPARTMENT` ≥ `OWN` ≥ `NONE`
- Höherer Scope erfüllt niedrigere Anforderungen

### UserFeaturesSerializer

**Neues Feld:**
```python
permission_scopes = serializers.SerializerMethodField()
```

**API Response:**
```json
{
  "can_view_workorders": true,
  "can_edit_workorders": true,
  "permission_scopes": {
    "can_view_workorders": "ALL",
    "can_edit_workorders": "OWN",
    "can_view_absences": "DEPARTMENT"
  }
}
```

## Frontend API

### UserFeaturesService - Neue Methoden

#### `getPermissionScope(permissionCode)`
```typescript
const scope = userFeatures.getPermissionScope('can_view_workorders');
// Returns: 'NONE' | 'OWN' | 'DEPARTMENT' | 'ALL' | null
```

#### `hasScope(permissionCode, requiredScope)`
```typescript
// Prüft ob User alle Arbeitsscheine sehen darf
if (userFeatures.hasScope('can_view_workorders', 'ALL')) {
  // Zeige alle Arbeitsscheine
}

// Prüft ob User mindestens Abteilungs-Arbeitsscheine sehen darf
if (userFeatures.hasScope('can_view_workorders', 'DEPARTMENT')) {
  // Zeige eigene + Abteilungs-Arbeitsscheine
}

// Prüft ob User eigene Arbeitsscheine sehen darf
if (userFeatures.hasScope('can_view_workorders', 'OWN')) {
  // Zeige nur eigene Arbeitsscheine
}
```

### TypeScript Interfaces

**UserFeatures:**
```typescript
export interface UserFeatures {
  // ... existing fields
  permission_scopes?: {
    [key: string]: 'NONE' | 'OWN' | 'DEPARTMENT' | 'ALL';
  };
}
```

**PermissionCode:**
```typescript
export interface PermissionCode {
  // ... existing fields
  supports_scope: boolean;
  default_scope: PermissionScope;
}
```

**PermissionMapping:**
```typescript
export interface PermissionMapping {
  // ... existing fields
  scope?: PermissionScope;  // überschreibt default_scope
}
```

**PermissionScope Enum:**
```typescript
export enum PermissionScope {
  NONE = 'NONE',
  OWN = 'OWN',
  DEPARTMENT = 'DEPARTMENT',
  ALL = 'ALL'
}
```

## Verwendungsbeispiele

### Backend: QuerySet Filtering

```python
from auth_user.permission_service import PermissionService

def get_workorders_for_user(user):
    perm_service = PermissionService.for_user(user)
    scope = perm_service.get_permission_scope('can_view_workorders')
    
    if scope == 'ALL':
        return Workorder.objects.all()
    elif scope == 'DEPARTMENT':
        user_departments = user.department_memberships.values_list('department_id', flat=True)
        return Workorder.objects.filter(department_id__in=user_departments)
    elif scope == 'OWN':
        return Workorder.objects.filter(assigned_to=user)
    else:
        return Workorder.objects.none()
```

### Frontend: Conditional Rendering

```typescript
export class WorkordersPage {
  readonly userFeatures = inject(UserFeaturesService);
  
  get canSeeAllWorkorders(): boolean {
    return this.userFeatures.hasScope('can_view_workorders', 'ALL');
  }
  
  get canSeeDepartmentWorkorders(): boolean {
    return this.userFeatures.hasScope('can_view_workorders', 'DEPARTMENT');
  }
  
  loadWorkorders() {
    const scope = this.userFeatures.getPermissionScope('can_view_workorders');
    
    // API-Call mit Scope-Parameter
    this.http.get(`/api/workorders/?scope=${scope}`).subscribe(...);
  }
}
```

```html
<!-- Zeige Filter nur wenn User alle sehen darf -->
@if (canSeeAllWorkorders) {
  <ion-select label="Filter">
    <ion-select-option value="all">Alle</ion-select-option>
    <ion-select-option value="dept">Meine Abteilung</ion-select-option>
    <ion-select-option value="own">Nur meine</ion-select-option>
  </ion-select>
}
```

## Migration

```bash
# Migration erstellen und ausführen
docker exec bogdol_go_backend_dev python manage.py makemigrations auth_user
docker exec bogdol_go_backend_dev python manage.py migrate

# Permissions aktualisieren
docker exec bogdol_go_backend_dev python seed_permissions.py
```

**Migration:** `0034_add_permission_scope.py`

## Admin-Konfiguration

### Via Django Admin

1. **PermissionCode bearbeiten:**
   - `supports_scope` aktivieren
   - `default_scope` setzen (OWN/DEPARTMENT/ALL/NONE)

2. **PermissionMapping bearbeiten:**
   - `scope` Feld setzen (optional)
   - Überschreibt `default_scope` der Permission

### Via Permission-Config UI (Frontend)

**Geplant:**
- Scope-Auswahl bei Permission-Zuweisung
- Visual Indicator für Scope-Level
- Dropdown mit NONE/OWN/DEPARTMENT/ALL

## Best Practices

### Wann welchen Default-Scope?

- **NONE**: Nur für App-Zugriffe, Features ohne Objekt-Bezug
- **OWN**: Standard für persönliche Daten (eigene Arbeitsscheine, Abwesenheiten)
- **DEPARTMENT**: Für Abteilungsleiter, Team-Manager
- **ALL**: Für HR, Admin, zentrale Verwaltung

### Scope Override in Mappings

```python
# Standard: Faktur-Mitarbeiter sehen nur EIGENE Arbeitsscheine
PermissionMapping.objects.create(
    entity_type='SPECIALTY',
    entity_id=faktur.id,
    permission=can_view_workorders,
    # scope=None → nutzt default_scope='OWN'
)

# Override: Faktur-Leiter sehen ALLE Arbeitsscheine
PermissionMapping.objects.create(
    entity_type='ROLE',
    entity_id=faktur_leiter.id,
    permission=can_view_workorders,
    scope='ALL'  # Überschreibt default_scope
)
```

## Testing

Test-Script: `backend/go/test_scope_system.py`

```bash
docker exec bogdol_go_backend_dev python test_scope_system.py
```

Zeigt:
1. Alle Permissions mit Scope-Unterstützung
2. Scope-Checks für Test-User
3. Beispiel-Mappings mit effektivem Scope

## Abwärtskompatibilität

**Keine Breaking Changes:**
- Bestehende Permissions ohne `supports_scope` funktionieren wie vorher
- `default_scope='NONE'` für alle existierenden Permissions
- Alte `has_permission()` Methode funktioniert weiterhin
- Frontend kann `permission_scopes` optional nutzen

## Deprecated Features

**`can_view_all_workorders`** - DEPRECATED
- Nutze stattdessen `can_view_workorders` mit Scope=ALL
- Bleibt für Migration vorerst erhalten

## Zukünftige Erweiterungen

1. **Scope-Kombinationen:** OWN + DEPARTMENT
2. **Zeitliche Scopes:** nur aktuelle, historische
3. **Custom Scopes:** rollenspezifische Filter
4. **Scope-Vererbung:** automatische Scope-Eskalation

---

**Erstellt:** 2026-01-09  
**Migration:** 0034_add_permission_scope  
**Status:** ✅ Produktionsreif
