# 🔐 Flexibles Permission-System - Komplett implementiert

## ✅ Was wurde umgesetzt

### **Backend (Django)**

#### 1. **Datenbank-Models**
- `PermissionCode` - Zentrale Definition aller verfügbaren Permissions
- `PermissionMapping` - Flexible Zuordnung Entity → Permission
- Migration: `0032_add_permission_mapping_system.py`

#### 2. **Permission Service**
- `PermissionService.for_user(user)` - Factory-Methode
- `has_permission(code)` - Dynamische Permission-Prüfung
- Prüft hierarchisch: Department → Role → Specialty → Group
- Cache-Unterstützung (10 Minuten)

#### 3. **API Endpoints**
```
GET    /api/permission-codes/                    # Liste aller Permission Codes
GET    /api/permission-codes/by-category/        # Gruppiert nach Kategorie
GET    /api/permission-mappings/                 # Alle Mappings
GET    /api/permission-mappings/for-entity/      # Für spezifische Entity
POST   /api/permission-mappings/bulk-update/     # Bulk-Konfiguration
POST   /api/permission-mappings/clear-cache/     # Cache invalidieren
```

#### 4. **UserFeaturesSerializer**
- Nutzt PermissionService statt Hardcoding
- Frontend-kompatibel (keine Änderungen nötig)
- Endpoint: `/api/users/features/`

#### 5. **Django Admin**
- `PermissionCode` Admin - Verwaltung der Permission-Codes
- `PermissionMapping` Admin - Verwaltung der Zuordnungen
- Verfügbar unter `/admin-go/`

#### 6. **Seeding**
- Script: `seed_permissions.py` - Erstellt 25 Default-Permissions
- Script: `demo_faktur_permissions.py` - Demo-Konfiguration

---

### **Frontend (Angular + Ionic)**

#### 1. **Models**
- `permission.model.ts` - TypeScript Interfaces
- `PermissionCode`, `PermissionMapping`, `EntityType`

#### 2. **Service**
- `PermissionConfigService` - API-Integration
- Signal-basiertes State Management
- Bulk-Update Unterstützung

#### 3. **Komponente**
- `PermissionConfigPage` - Admin-UI für Permission-Konfiguration
- 3 Tabs: Departments, Rollen, Fachbereiche
- Accordion-basierte Permission-Auswahl nach Kategorie
- Bulk-Speicherung mit Feedback

#### 4. **Routing**
- Route: `/admin/permission-config`
- Guard: `adminGuard`
- Navigation: Admin-Dashboard Kachel "Berechtigungen"

---

## 🎯 Wie es funktioniert

### **Backend-Flow:**

```python
# 1. User Feature Request
GET /api/users/features/

# 2. UserFeaturesSerializer
perms = PermissionService.for_user(user)
can_view_workorders = perms.has_permission('can_view_workorders')

# 3. PermissionService prüft
# - Superuser/Staff? → True (Bypass)
# - Department Permissions? → PermissionMapping check
# - Role Permissions? → PermissionMapping check
# - Specialty Permissions? → PermissionMapping check
# - Group Permissions? → PermissionMapping check
```

### **Frontend-Flow:**

```typescript
// 1. Dashboard lädt Features
userFeatures.loadFeatures()

// 2. Template prüft
@if (userFeatures.features()?.can_view_workorders) {
  <ion-card>Arbeitsscheine</ion-card>
}

// 3. Admin konfiguriert
/admin/permission-config
→ Wählt "Fachbereiche" → "Fakturierung"
→ Checkt "can_view_workorders"
→ Speichern → Bulk-Update API
```

---

## 📋 Verfügbare Permissions (25 Stück)

### **Apps & Features**
- `can_view_sofo` - Sofortmeldungen anzeigen
- `can_view_work_tickets` - Work-Tickets anzeigen
- `can_view_contacts` - Mitarbeiterverzeichnis anzeigen
- `can_view_chat` - Chat anzeigen
- `can_view_organigramm` - Organigramm anzeigen
- `can_view_external_links` - Externe Links anzeigen

### **Workorders**
- `can_view_workorders` - Arbeitsscheine anzeigen
- `can_edit_workorders` - Arbeitsscheine bearbeiten
- `can_download_workorder_pdf` - AS-PDF herunterladen
- `can_cancel_workorder` - Arbeitsscheine stornieren
- `can_view_all_workorders` - Alle AS anzeigen (Toggle)

### **Absences**
- `can_view_absences` - Abwesenheiten anzeigen
- `can_approve_absences` - Abwesenheiten genehmigen
- `can_manage_absences` - Abwesenheiten verwalten

### **Admin**
- `can_view_admin` - Admin-Bereich anzeigen
- `can_view_users` - Benutzerverwaltung
- `can_manage_users` - Benutzer verwalten
- `can_view_companies` - Gesellschaften verwalten
- `can_view_departments` - Abteilungen verwalten
- `can_view_roles` - Rollen verwalten
- `can_view_absence_types` - Abwesenheitsarten verwalten
- `can_view_specialties` - Fachbereiche verwalten
- `can_view_ai_training` - KI-Training verwalten
- `can_manage_permissions` - Berechtigungen verwalten

### **Analytics**
- `can_view_analytics` - Auswertungen anzeigen

---

## 🚀 Verwendung

### **1. Permission konfigurieren (Frontend)**

```
1. Öffne: http://localhost:4200/admin/permission-config
2. Wähle Tab: "Fachbereiche"
3. Klicke auf: "Fakturierung"
4. Checke Permissions:
   ✅ can_view_workorders
   ✅ can_edit_workorders
   ✅ can_download_workorder_pdf
5. Klicke: "Permissions speichern"
```

### **2. Specialty einem User zuweisen**

```
1. Öffne: /admin/users/
2. Bearbeite User
3. Gehe zu "Abteilungszuordnung bearbeiten"
4. Wähle unter "Fachbereich": Fakturierung
5. Speichern
```

### **3. Testen**

```
1. Login als dieser User
2. Dashboard lädt Features
3. Kachel "Arbeitsscheine" ist sichtbar ✅
```

---

## 🛠️ Entwickler-Tools

### **Seeding ausführen:**
```bash
docker exec bogdol_go_backend_dev python seed_permissions.py
```

### **Demo-Konfiguration erstellen:**
```bash
docker exec bogdol_go_backend_dev python demo_faktur_permissions.py
```

### **Permissions testen:**
```bash
docker exec bogdol_go_backend_dev python test_permissions.py
```

### **Cache löschen:**
```python
from auth_user.permission_service import PermissionService
PermissionService.clear_all_caches()
```

---

## 🎨 Frontend-Komponenten

### **Service einbinden:**
```typescript
import { PermissionConfigService } from '@services/permission-config.service';

export class MyComponent {
  readonly permissionService = inject(PermissionConfigService);
  
  ngOnInit() {
    this.permissionService.loadPermissionCodes().subscribe();
  }
}
```

### **Permissions prüfen:**
```typescript
// Im Backend bereits integriert via UserFeaturesService
readonly userFeatures = inject(UserFeaturesService);

ngOnInit() {
  this.userFeatures.loadFeatures().subscribe();
}

// In Template
@if (userFeatures.features()?.can_view_workorders) {
  <!-- Nur für berechtigte User -->
}
```

---

## 📊 Datenbank-Schema

```
PermissionCode
├── id: int
├── code: string (unique)
├── name: string
├── description: text
├── category: enum
├── display_order: int
└── is_active: boolean

PermissionMapping
├── id: int
├── entity_type: enum (DEPARTMENT, ROLE, SPECIALTY, GROUP)
├── entity_id: int
├── permission: FK → PermissionCode
├── object_type: string (optional)
├── object_id: int (optional)
├── is_active: boolean
└── created_by: FK → User
```

---

## 🔍 Beispiel-Szenario

### **Faktur-Mitarbeiter konfigurieren**

**VORHER (Hardcoded):**
```python
# ❌ Im Code fest verdrahtet
has_faktur = MemberSpecialty.objects.filter(
    specialty__code='FAKTUR'
).exists()
```

**NACHHER (Flexibel):**

1. **Admin öffnet:** `/admin/permission-config`
2. **Wählt:** Tab "Fachbereiche" → "Fakturierung"
3. **Checkt:**
   - ✅ can_view_workorders
   - ✅ can_edit_workorders
   - ✅ can_download_workorder_pdf
4. **Speichert:** Bulk-Update
5. **Fertig!** Keine Code-Änderung nötig

**User mit Faktur-Specialty:**
- Hat automatisch alle konfigurierten Permissions
- Dashboard zeigt Arbeitsscheine-Kachel
- Kann AS bearbeiten und PDFs downloaden

---

## ✅ Vorteile des neuen Systems

1. **Keine Code-Änderungen** mehr für neue Permissions
2. **Frontend-Konfiguration** über Admin-UI
3. **Flexible Zuordnung** zu Departments/Rollen/Fachbereichen
4. **Performance** durch Caching (10 Min)
5. **Audit-Trail** (created_by, created_at)
6. **Bulk-Updates** für schnelle Konfiguration
7. **Kategorie-basiert** für bessere Übersicht
8. **Objekt-spezifisch** optional möglich

---

## 🔮 Nächste Schritte

1. **Weitere Permissions definieren** (z.B. für neue Features)
2. **Default-Mappings** für Standardrollen erstellen
3. **Permission-Templates** für häufige Kombinationen
4. **Audit-Log** für Permission-Änderungen
5. **Bulk-Import/Export** für Backup

---

## 📝 Zusammenfassung

**Das System ist jetzt vollständig flexibel!**

✅ Backend: PermissionService + API
✅ Frontend: Admin-UI für Konfiguration  
✅ Integration: UserFeaturesSerializer nutzt PermissionService
✅ Demo-Daten: Faktur-Specialty mit Workorder-Permissions
✅ Dokumentation: Vollständig

**Keine Hardcoding mehr - alles konfigurierbar! 🎉**
