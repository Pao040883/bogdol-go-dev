# Phase 9 - Frontend Integration Checkliste

## Status: 70% Abgeschlossen ✅

---

## ✅ FERTIG - Admin Management UI

### Specialty Management
- ✅ `specialties.page.ts` - Fachbereichs-Verwaltung
- ✅ `specialty-modal.component.ts` - Create/Edit Modal
- ✅ Hierarchische Anzeige (Parent-Child)
- ✅ Gruppierung nach Departments
- ✅ Suche & Filter

### Member Specialty Management
- ✅ `member-specialties.page.ts` - User-Zuordnungen
- ✅ `member-specialty-modal.component.ts` - Assignment Modal
- ✅ Proficiency Level Management (1-4)
- ✅ Validity Dates (valid_from/valid_until)
- ✅ Primary Toggle
- ✅ Notes Field

### Shared Components
- ✅ `specialty-badge.component.ts` - Badge-Komponente
- ✅ `user-specialties-card.component.ts` - Card-Komponente für Profile
- ✅ `filter-by-department.pipe.ts` - Department Filter

### Guards & Security
- ✅ `permission.guard.ts` - Extended mit:
  - `specialtyGuard(requiredSpecialty)` - Route protection
  - `fullAccessGuard` - GF/Admin only routes
- ✅ OrganizationService integration
- ✅ Toast notifications für access denied

### Organigramm Integration
- ✅ `organigramm.page.ts` - Extended mit:
  - MemberSpecialty loading
  - Specialties display in nodes
  - Proficiency color coding
  - Primary specialty highlighting
  - Staff position (Stabsstelle) styling
- ✅ `organigramm.page.scss` - Styling:
  - `.node-specialties` - Fachbereich badges
  - `.staff-position` - Stabsstellen marker
  - `.specialty-badge` - Color-coded proficiency

---

## ⏳ IN ARBEIT - Weitere Integrationen

### 1. User Profile Extension
**Datei**: `frontend/src/app/pages/apps/contacts-list/contacts-list.page.ts`

**Aufgaben**:
- [ ] Import `UserSpecialtiesCardComponent`
- [ ] Anzeige in User Detail Modal/Page
- [ ] Department Memberships anzeigen
- [ ] Substitutions anzeigen (wer vertritt wen)
- [ ] "Manage Specialties" Button (nur für Admins)

**Code-Beispiel**:
```html
<ion-card>
  <ion-card-header>
    <ion-card-title>{{ user.full_name }}</ion-card-title>
  </ion-card-header>
  <ion-card-content>
    <!-- Existing profile content -->
    
    <!-- NEW: Specialties -->
    <app-user-specialties-card [userId]="user.id"></app-user-specialties-card>
    
    <!-- NEW: Department Memberships -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Abteilungs-Zugehörigkeiten</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @for (membership of user.department_memberships; track membership.id) {
          <ion-chip [color]="membership.is_primary ? 'warning' : 'primary'">
            <ion-label>{{ membership.department_data.name }}</ion-label>
            @if (membership.is_primary) {
              <ion-icon name="star"></ion-icon>
            }
            @if (membership.is_staff_position) {
              <ion-icon name="briefcase-outline"></ion-icon>
            }
          </ion-chip>
        }
      </ion-card-content>
    </ion-card>
  </ion-card-content>
</ion-card>
```

---

### 2. Arbeitsschein Permission Integration
**Dateien**:
- `frontend/src/app/pages/apps/work-tickets/work-ticket-detail.page.ts`
- `frontend/src/app/pages/apps/work-tickets/work-ticket-form.page.ts`

**Aufgaben**:
- [ ] Import `OrganizationService`
- [ ] Permission Check vor Edit-Modus
- [ ] `canProcessWorkorder()` verwenden
- [ ] Read-Only Modus wenn keine Berechtigung
- [ ] Auto-Assignment Button
- [ ] Reassignment mit Permission Check

**Code-Beispiel**:
```typescript
// In work-ticket-detail.page.ts
import { OrganizationService } from '../../../core/services/organization.service';

export class WorkTicketDetailPage implements OnInit {
  canEdit = signal(false);
  
  constructor(
    private organizationService: OrganizationService,
  ) {}
  
  ngOnInit() {
    this.checkPermissions();
  }
  
  checkPermissions() {
    this.organizationService.canProcessWorkorder(this.ticketId).subscribe({
      next: (canProcess) => {
        this.canEdit.set(canProcess);
        if (!canProcess) {
          // Show read-only view
          this.toastService.show('Keine Berechtigung zur Bearbeitung', { color: 'warning' });
        }
      }
    });
  }
}
```

**HTML**:
```html
@if (canEdit()) {
  <ion-button (click)="editTicket()">Bearbeiten</ion-button>
} @else {
  <ion-chip color="warning">
    <ion-icon name="lock-closed"></ion-icon>
    <ion-label>Nur Ansicht</ion-label>
  </ion-chip>
}
```

---

### 3. Absence/Vertretung Integration
**Dateien**:
- `frontend/src/app/pages/apps/absences/absences.page.ts`
- `frontend/src/app/pages/apps/absences/absence-create-modal.component.ts`

**Aufgaben**:
- [ ] Import `OrganizationService`
- [ ] Active Substitutions anzeigen
- [ ] Vertretungs-Auswahl mit Specialty-Filter
- [ ] Transitive Vertretungen anzeigen
- [ ] `canApproveAbsence()` für Approval-Buttons

**Code-Beispiel**:
```typescript
// In absence-create-modal.component.ts
loadSubstitutes() {
  this.organizationService.getActiveSubstitutions().subscribe({
    next: (substitutions) => {
      // Filter by specialty if needed
      this.availableSubstitutes = substitutions.filter(sub => {
        // Check if substitute has required specialty
        return sub.specialties?.some(spec => 
          spec.specialty_code === this.requiredSpecialtyCode
        );
      });
    }
  });
}
```

---

### 4. Dashboard/Übersicht
**Datei**: `frontend/src/app/pages/dashboard/dashboard.page.ts` (falls vorhanden)

**Aufgaben**:
- [ ] "Meine Fachbereiche" Widget
- [ ] "Meine Vertretungen" Widget
- [ ] Quick Links basierend auf Specialties
- [ ] Pending Assignments Benachrichtigungen

**Code-Beispiel**:
```typescript
// Dashboard Widget
loadMySpecialties() {
  this.organizationService.getMySpecialties().subscribe({
    next: (specialties) => {
      this.mySpecialties.set(specialties);
      
      // Enable specialty-specific widgets
      const hasFaktura = specialties.some(s => s.specialty_data?.code === 'FIN-FAK');
      if (hasFaktura) {
        this.showFakturaWidget.set(true);
      }
    }
  });
}
```

---

## 🔧 OPTIONAL - Erweiterte Features

### 5. Workorder Auto-Assignment UI
**Datei**: Neue Komponente `workorder-auto-assign.component.ts`

**Features**:
- Button "Auto-Zuweisen" in Workorder-Form
- Specialty Selection Dropdown
- Loading State während Assignment
- Success/Error Toast Feedback

### 6. Substitute Assignment Management UI
**Datei**: Neue Page `substitute-assignments.page.ts`

**Features**:
- Liste aller Vertretungen
- Filter: Aktiv, Zukünftig, Abgelaufen
- Transitive Chain Visualisierung
- Specialty Restriction Management

### 7. Specialty-Based Navigation
**Datei**: `frontend/src/app/app.routes.ts`

**Features**:
- Dynamische Menu-Items basierend auf Specialties
- Route Guards mit `specialtyGuard()`
- Feature Flags pro Fachbereich

**Code-Beispiel**:
```typescript
{
  path: 'fakturierung',
  loadComponent: () => import('./pages/fakturierung/fakturierung.page'),
  canActivate: [specialtyGuard('FIN-FAK')]
},
{
  path: 'admin/specialties',
  loadComponent: () => import('./pages/admin/specialties/specialties.page'),
  canActivate: [fullAccessGuard]
}
```

---

## 📝 Phase 10 - CSS/Styling

### Verbleibende Styling-Aufgaben
- [ ] Stabsstellen-Visualisierung finalisieren
  - Border Color: `var(--ion-color-warning)`
  - Background Gradient
  - Icon-Badge Position
- [ ] Fachbereich-Chips konsistent gestalten
  - Farben harmonisieren
  - Hover-Effekte
  - Mobile Responsiveness
- [ ] Organigramm Spacing optimieren
  - Node Abstände
  - Specialty Badge Wrapping
  - Zoom-Level Anpassungen
- [ ] Dark Mode Support
  - Specialty Badge Farben
  - Staff Position Marker
  - Card Backgrounds

---

## 🧪 Testing Checklist

### Backend Testing
- [x] Specialty CRUD via Admin
- [x] MemberSpecialty Assignment
- [x] WorkorderAssignment auto-create
- [x] SubstituteAssignment Signal
- [x] Permission Checks API

### Frontend Testing
- [ ] Specialty Management Page
  - [ ] Create Specialty
  - [ ] Edit Specialty
  - [ ] Delete Specialty
  - [ ] Hierarchical Display
- [ ] Member Specialty Assignment
  - [ ] Assign Specialty to User
  - [ ] Change Proficiency Level
  - [ ] Set Primary Specialty
  - [ ] Validity Dates
- [ ] Organigramm
  - [ ] Specialty Badges angezeigt
  - [ ] Stabsstellen markiert
  - [ ] Colors korrekt
- [ ] Permission Guards
  - [ ] specialtyGuard blockt ohne Berechtigung
  - [ ] fullAccessGuard nur für GF/Admin
  - [ ] Toast Notifications angezeigt

### Integration Testing
- [ ] User mit mehreren Departments im Organigramm
- [ ] Workorder Assignment basierend auf Specialty
- [ ] Vertretung mit Specialty Restriction
- [ ] Transitive Vertretungen (A→B→C)

---

## 📦 Deployment Checklist

### Backend
- [x] Migrations angewendet (0026, 0027)
- [x] Admin Interface verfügbar
- [x] API Endpoints dokumentiert
- [ ] Seeding-Script für Test-Daten

### Frontend
- [ ] Routes registriert
- [ ] Components lazy-loaded
- [ ] Guards in routes integriert
- [ ] Build-Test erfolgreich

### Dokumentation
- [x] FACHBEREICHS_SYSTEM_DOKUMENTATION.md
- [ ] API Endpoint Dokumentation
- [ ] User Guide für Admins
- [ ] Permission Matrix Tabelle

---

## 🎯 Nächste Schritte (Priorität)

1. **HOCH**: User Profile Extension (Contacts-List Page)
   - Specialties Card einbinden
   - Department Memberships anzeigen
   - ~2 Stunden

2. **HOCH**: Arbeitsschein Permission Integration
   - Edit-Berechtigung prüfen
   - Read-Only Modus
   - ~2 Stunden

3. **MITTEL**: Absence Vertretungs-Integration
   - Substitute Selection mit Specialty Filter
   - Active Substitutions anzeigen
   - ~1 Stunde

4. **NIEDRIG**: Dashboard Widgets
   - Meine Fachbereiche Widget
   - ~1 Stunde

5. **NIEDRIG**: Phase 10 Styling
   - Stabsstellen Final Polish
   - Dark Mode Support
   - ~1 Stunde

---

## 📊 Gesamtfortschritt

```
Backend:  ████████████████████ 100%
Frontend: ██████████████░░░░░░  70%
Testing:  ████░░░░░░░░░░░░░░░░  20%
Gesamt:   ████████████░░░░░░░░  63%
```

**Geschätzte verbleibende Zeit**: 6-8 Stunden

---

## 💡 Hinweise

- **OrganizationService** ist zentral für alle Permission-Checks
- **Signals** verwenden für reaktive UI
- **firstValueFrom** für async/await mit Observables
- **ToastService** für User-Feedback
- **specialtyGuard** und **fullAccessGuard** für Route Protection
- **Lazy Loading** für bessere Performance

---

Erstellt: {{ now }}
Status: In Arbeit
Letzte Aktualisierung: Phase 9 - Organigramm Integration abgeschlossen
