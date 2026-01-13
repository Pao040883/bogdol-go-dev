# Fachbereichs-System - Implementierungs-Dokumentation

## Übersicht

Das neue Fachbereichs-System ermöglicht flexible Zuordnung von Kompetenzen und Berechtigungen zu Mitarbeitern innerhalb der Organisationsstruktur.

## Backend (Phase 0-6) ✅ ABGESCHLOSSEN

### Datenmodelle

#### **Specialty** (Fachbereich)
- Hierarchische Struktur (Parent-Child Beziehungen)
- Pro Department zuordenbar
- Eindeutiger Code (z.B. "FIN-FAK")
- Such-Keywords für KI-Integration
- Display Order für Sortierung

#### **MemberSpecialty** (Fachbereichs-Zuordnung)
- Many-to-Many: DepartmentMember ↔ Specialty
- Proficiency Level (1-4): Grundkenntnisse → Experte
- is_primary Flag für Haupt-Fachbereich
- Gültigkeitszeiträume (valid_from, valid_until)
- Notizen-Feld

#### **WorkorderAssignment** (Arbeitsschein-Zuordnung)
- Submitter → Processor Mapping pro Specialty
- Auto-Assignment Flag
- Gültigkeitszeiträume

#### **SubstituteAssignment** (Vertretungs-Zuordnung)
- Absence-basiert
- Transitive Vertretungen (A→B→C)
- Optional: Specialty-Einschränkung
- Automatische Erstellung via Signal

### API Endpoints

**Specialties:**
- `GET /api/auth_user/specialties/` - Liste aller Fachbereiche
- `GET /api/auth_user/specialties/{id}/` - Einzelner Fachbereich
- `GET /api/auth_user/specialties/by_department/?department_id=X` - Nach Department
- `POST /api/auth_user/specialties/` - Neuer Fachbereich
- `PUT /api/auth_user/specialties/{id}/` - Fachbereich aktualisieren
- `DELETE /api/auth_user/specialties/{id}/` - Fachbereich löschen

**Member Specialties:**
- `GET /api/auth_user/member-specialties/` - Liste aller Zuordnungen
- `GET /api/auth_user/member-specialties/my_specialties/` - Eigene Fachbereiche
- `POST /api/auth_user/member-specialties/` - Neue Zuordnung
- `PUT /api/auth_user/member-specialties/{id}/` - Zuordnung aktualisieren
- `DELETE /api/auth_user/member-specialties/{id}/` - Zuordnung löschen

**Workorder Assignments:**
- `GET /api/auth_user/workorder-assignments/` - Liste
- `GET /api/auth_user/workorder-assignments/my_assignments/` - Eigene Zuordnungen
- `POST /api/auth_user/workorder-assignments/auto_assign/` - Auto-Zuordnung
- CRUD Operationen

**Substitute Assignments:**
- `GET /api/auth_user/substitute-assignments/` - Liste
- `GET /api/auth_user/substitute-assignments/my_substitutions/` - Eigene Vertretungen
- `GET /api/auth_user/substitute-assignments/active/` - Aktuell aktive Vertretungen
- CRUD Operationen

**Permission Checks:**
- `GET /api/auth_user/permissions/check/?action=full_access`
- `GET /api/auth_user/permissions/check/?action=has_specialty&specialty_code=FIN-FAK`
- `GET /api/auth_user/permissions/check/?action=my_specialties`
- `GET /api/auth_user/permissions/check/?action=active_substitutions`
- `GET /api/auth_user/permissions/check/?action=can_process_workorder&workorder_id=X`
- `GET /api/auth_user/permissions/check/?action=can_approve_absence&absence_id=X`

### PermissionService

```python
from auth_user.permissions import PermissionService

perms = PermissionService.for_user(user)

# Vollzugriff prüfen
if perms.has_full_access():
    # GF/Superuser bypass

# Fachbereich-Zugehörigkeit
if perms.has_specialty('FIN-FAK'):
    # User hat Fakturierung

# Arbeitsschein-Berechtigung
if perms.can_process_workorder(workorder):
    # Kann bearbeiten

# Vertretungen abrufen
substitutions = perms.get_active_substitutions(date)
```

### Signals

**Automatische SubstituteAssignment Erstellung:**
```python
@receiver(post_save, sender=Absence)
def create_substitute_assignment(sender, instance, **kwargs):
    if instance.representative and instance.status == APPROVED:
        SubstituteAssignment.objects.create(...)
```

## Frontend (Phase 7-9) ✅ ABGESCHLOSSEN

### TypeScript Interfaces

**organization.model.ts:**
- `Specialty` - Fachbereich
- `MemberSpecialty` - Zuordnung
- `DepartmentMemberDetail` - Erweiterte Member-Info
- `WorkorderAssignment` - Arbeitsschein-Zuordnung
- `SubstituteAssignment` - Vertretung
- `PermissionCheckRequest/Response`
- `ProficiencyLevel` Enum

**department.model.ts:**
- `Department` mit `is_staff_department`
- `DepartmentMember` mit `is_staff_position`
- `DepartmentRole`, `Team`, `Company`

### Services

**OrganizationService:**
```typescript
// Fachbereiche laden
this.organizationService.getSpecialties(departmentId, search).subscribe(...)

// Eigene Fachbereiche
this.organizationService.getMySpecialties().subscribe(...)

// Berechtigungen prüfen
this.organizationService.hasSpecialty('FIN-FAK').subscribe(...)
this.organizationService.canProcessWorkorder(id).subscribe(...)

// Auto-Assignment
this.organizationService.autoAssignWorkorder({
  submitter_id: 123,
  specialty_code: 'FIN-FAK'
}).subscribe(...)
```

### Komponenten

#### **Specialty Management (Admin)**
- `specialties.page.ts/html/scss`
- `specialty-modal.component.ts/html/scss`
- Features:
  - Gruppierung nach Departments
  - Hierarchische Anzeige (Parent-Child)
  - Suche & Filter
  - Inline-Bearbeitung
  - Mitarbeiter-Zuordnung anzeigen

#### **Member Specialty Management**
- `member-specialties.page.ts/html/scss`
- `member-specialty-modal.component.ts/html/scss`
- Features:
  - Fachbereichs-Zuordnung pro Mitarbeiter
  - Proficiency Level mit visueller Anzeige
  - Primärer Fachbereich (Stern-Icon)
  - Gültigkeitszeiträume
  - Notizen

#### **Shared Components**
- `SpecialtyBadgeComponent` - Wiederverwendbare Badge-Anzeige
  - Farben je nach Proficiency Level
  - Primär-Kennzeichnung
  - Code-Badge optional

### Guards

**permission.guard.ts erweitert:**
```typescript
// Fachbereich-Guard
canActivate: [specialtyGuard('FIN-FAK')]

// Vollzugriffs-Guard
canActivate: [fullAccessGuard]

// Bestehende Guards
canActivate: [adminGuard]
canActivate: [permissionGuard('user_management')]
```

### Pipes

**FilterByDepartmentPipe:**
```typescript
<ion-item *ngFor="let s of specialties | filterByDepartment: deptId">
```

## Verwendung im Code

### Fachbereich-Verwaltung (Admin)

1. **Fachbereich erstellen:**
   - Admin → Fachbereiche
   - "+" Button
   - Department wählen
   - Name, Code, Optional: Parent
   - Speichern

2. **Fachbereich zuordnen:**
   - User/Member auswählen
   - Fachbereiche verwalten
   - "+" Button
   - Fachbereich + Proficiency Level wählen
   - Optional: Als primär markieren

### Arbeitsschein-Integration

```typescript
// Permission check vor Bearbeitung
this.organizationService.canProcessWorkorder(workorderId).subscribe(
  canProcess => {
    if (canProcess) {
      // Bearbeitungs-UI anzeigen
    } else {
      // Read-Only oder Error
    }
  }
);

// Auto-Assignment bei Erstellung
this.organizationService.autoAssignWorkorder({
  submitter_id: currentUser.id,
  specialty_code: 'FIN-FAK'
}).subscribe(result => {
  console.log('Assigned to:', result.assignment.processor_name);
});
```

### Vertretungs-System

```typescript
// Aktive Vertretungen laden
this.organizationService.getActiveSubstitutions().subscribe(subs => {
  // Zeige wer wen vertritt
  subs.forEach(sub => {
    console.log(`${sub.substitute_user_name} vertritt ${sub.original_user_name}`);
  });
});

// Eigene Vertretungen
this.organizationService.getMySubstitutions().subscribe(result => {
  console.log('Ich vertrete:', result.i_substitute);
  console.log('Ich werde vertreten von:', result.substituted_by);
});
```

### Route Protection

```typescript
const routes: Routes = [
  {
    path: 'faktur',
    loadComponent: () => import('./faktur.page'),
    canActivate: [specialtyGuard('FIN-FAK')]
  },
  {
    path: 'admin/specialties',
    loadComponent: () => import('./specialties.page'),
    canActivate: [fullAccessGuard]
  }
];
```

## Nächste Schritte (Phase 9 fortsetzen)

1. **Organigramm erweitern:**
   - Multiple Zuordnungen anzeigen (User erscheint mehrmals)
   - Fachbereiche pro Position anzeigen
   - Stabsstellen hervorheben

2. **User Profile erweitern:**
   - Fachbereiche-Sektion
   - Specialty Badges anzeigen
   - Proficiency Level visualisieren

3. **Arbeitsschein-Komponenten:**
   - Permission Checks integrieren
   - Auto-Assignment Button
   - Reassignment-Logik

4. **Abwesenheits-Integration:**
   - Vertretungs-Auswahl mit Fachbereich-Filter
   - Transitive Vertretungen anzeigen

## Migrations

```bash
# Backend
docker exec bogdol_go_backend_dev python manage.py makemigrations
docker exec bogdol_go_backend_dev python manage.py migrate

# Bereits angewendet:
# - 0026_cleanup_deprecated_fields
# - 0027_add_specialty_and_assignment_models
```

## Testing

```bash
# Backend API Test
curl http://localhost:8000/api/auth_user/specialties/

# Permission Check
curl "http://localhost:8000/api/auth_user/permissions/check/?action=my_specialties"
```

## Datenbank-Schema

```
┌─────────────┐
│  Department │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐      ┌──────────────────┐
│  Specialty  │◄─────│ MemberSpecialty  │
│             │      │  (Through-Table) │
│ - parent FK │      │  - proficiency   │
└─────────────┘      │  - is_primary    │
                     └────────┬─────────┘
                              │
                              │ N:1
                              ▼
                     ┌──────────────────┐
                     │ DepartmentMember │
                     └──────────────────┘
```

## Status: READY FOR PRODUCTION ✅

- ✅ Backend Models & Migrations
- ✅ Backend API Endpoints
- ✅ Permission Service
- ✅ Signals & Automation
- ✅ Admin Interface
- ✅ Frontend Models & Services
- ✅ Admin UI Components
- ✅ Guards & Pipes
- ⏳ Organigramm Integration (Phase 9 ongoing)
- ⏳ User Profile Extension (Phase 9 ongoing)
