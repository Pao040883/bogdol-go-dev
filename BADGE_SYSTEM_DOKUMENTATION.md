# Badge-System Dokumentation

## Übersicht

Das Badge-System in BogDol GO zeigt Benachrichtigungs-Badges für verschiedene Module an. Badges werden in der Navigation, auf Kacheln und im Dashboard angezeigt.

## Architektur

### 1. BadgeService (`frontend/src/app/services/badge.service.ts`)

Zentraler Service für alle Badge-Counts im System.

**Badge-State:**
```typescript
export interface BadgeState {
  chat: number;              // Ungelesene Chat-Nachrichten
  arbeitsscheine: number;    // Offene Arbeitsscheine
  organigramm: number;       // Organigramm-Updates
  sofortmeldungen: number;   // Offene Sofortmeldungen
  absences: number;          // Genehmigungs-Anträge
  users: number;             // Benutzer ohne Vorgesetzten
}
```

**Wichtige Observables:**
- `badges$` - Alle Badge-Counts
- `totalBadges$` - Gesamtzahl aller Badges
- `appBadges$` - Summe aller App-Badges (ohne Chat)

**Methoden:**
- `setBadge(source, count)` - Setzt Badge-Count
- `incrementBadge(source, increment)` - Erhöht Badge
- `decrementBadge(source, decrement)` - Verringert Badge
- `clearBadge(source)` - Setzt Badge auf 0
- `getBadge(source)` - Gibt Observable für spezifischen Badge zurück

### 2. App-Initialisierung (`frontend/src/app/app.component.ts`)

Badges werden beim App-Start (ngOnInit) geladen:

```typescript
ngOnInit() {
  this.badgeService.loadAllBadges();
  
  // Backend-Calls für initiale Badge-Counts
  this.workOrderService.loadBadgeCounts().subscribe();
  this.loadChatBadges();
  this.usersService.loadBadgeCounts().subscribe();
}
```

**Wichtig:** Jedes Modul macht einen **Backend-Call** beim App-Start!

## Modul-spezifische Implementierung

### Chat-Badges

**Initialisierung:** `app.component.ts`
```typescript
private loadChatBadges() {
  this.intranetApiService.getConversations().subscribe({
    next: (response) => {
      const totalUnread = response.results.reduce(
        (sum, conv) => sum + (conv.unread_count || 0), 0
      );
      this.badgeService.setBadge('chat', totalUnread);
    }
  });
}
```

**Backend-Endpoint:** `GET /api/chats/` - Liefert Konversationen mit `unread_count`

**Updates:** WebSocket-basiert in `chat-list.page.ts`
```typescript
private updateBadgeCount(): void {
  const totalUnread = this.conversations()
    .reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
  this.badgeService.setBadge('chat', totalUnread);
}
```

### Arbeitsschein-Badges

**Initialisierung:** `workorder.service.ts`
```typescript
loadBadgeCounts(): Observable<void> {
  return forkJoin({
    completed: this.http.get<WorkOrder[]>('/api/workorders/orders/', { 
      params: { status: 'completed' } 
    }),
    submitted: this.http.get<WorkOrder[]>('/api/workorders/orders/', { 
      params: { status: 'submitted' } 
    })
  }).pipe(
    tap(({ completed, submitted }) => {
      const openCount = completed.filter(wo => !wo.submitted_at).length;
      const billingCount = submitted.length;
      const totalCount = openCount + billingCount;
      
      this.badgeService.setBadge('arbeitsscheine', totalCount);
    })
  );
}
```

**Backend-Endpoints:** 
- `GET /api/workorders/orders/?status=completed`
- `GET /api/workorders/orders/?status=submitted`

**Updates:** Nach jedem CRUD-Vorgang via `updateBadgeCount()`

### Benutzer-Badges (Admin)

**Initialisierung:** `users.service.ts`
```typescript
loadBadgeCounts(): Observable<void> {
  return this.http.get<Users[]>('/api/admin/users/').pipe(
    tap((users) => {
      const activeUsers = users.filter(u => u.is_active);
      const usersWithoutSupervisor = activeUsers.filter(u => !u.supervisor);
      const count = usersWithoutSupervisor.length;
      
      this.badgeService.setBadge('users', count);
    })
  );
}
```

**Backend-Endpoint:** `GET /api/admin/users/` - Liefert alle Benutzer

**Updates:** Nach jedem Update via `updateBadgeCount()`
```typescript
private updateBadgeCount(): void {
  const count = this.usersWithoutSupervisor().length;
  this.badgeService.setBadge('users', count);
}
```

## Frontend-Anzeige

### Navigation (`home/navigation/navigation.component.html`)

```html
<!-- Chat Badge -->
<ion-item [routerLink]="['/chat']">
  <ion-icon name="chatbubbles-outline" slot="start"></ion-icon>
  <ion-label>Chat</ion-label>
  @if ((badgeService.getBadge('chat') | async) ?? 0; as chatBadges) {
    <ion-badge color="danger" slot="end">{{ chatBadges }}</ion-badge>
  }
</ion-item>

<!-- Apps Badge (Summe) -->
<ion-item [routerLink]="['/apps']">
  <ion-icon name="apps-outline" slot="start"></ion-icon>
  <ion-label>Apps</ion-label>
  @if ((badgeService.appBadges$ | async) ?? 0; as appBadges) {
    <ion-badge color="danger" slot="end">{{ appBadges }}</ion-badge>
  }
</ion-item>

<!-- Admin Badge -->
<ion-item [routerLink]="['/admin']">
  <ion-icon name="settings-outline" slot="start"></ion-icon>
  <ion-label>Admin</ion-label>
  @if ((badgeService.getBadge('users') | async) ?? 0; as userBadges) {
    <ion-badge color="warning" slot="end">{{ userBadges }}</ion-badge>
  }
</ion-item>
```

### Tile-Grid Komponente

**TileConfig Interface:**
```typescript
export interface TileConfig {
  id: string;
  title: string;
  badge?: string | number;      // Statischer Badge
  badge$?: Observable<number>;  // Dynamischer Badge (Observable)
}
```

**Template:**
```html
<!-- Statischer Badge (rot) -->
@if (tile.badge && tile.badge !== 0) {
  <ion-badge color="danger" slot="end">{{ tile.badge }}</ion-badge>
}

<!-- Dynamischer Badge (orange) -->
@if (tile.badge$ && ((tile.badge$ | async) ?? 0) > 0) {
  <ion-badge color="warning" slot="end">{{ tile.badge$ | async }}</ion-badge>
}
```

**Verwendung:**
```typescript
adminTiles: TileConfig[] = [
  {
    id: 'users',
    title: 'Benutzer',
    route: '/admin/users',
    badge$: this.badgeService.getBadge('users')  // Observable!
  }
];
```

### Dashboard

```html
<ion-item [routerLink]="['/admin/users']">
  <ion-label>
    <h3>Benutzer</h3>
    <p>Benutzerverwaltung</p>
  </ion-label>
  @if ((badgeService.getBadge('users') | async); as userBadge) {
    @if (userBadge > 0) {
      <ion-badge color="warning" slot="end">{{ userBadge }}</ion-badge>
    }
  }
</ion-item>
```

## Farb-Schema

| Badge-Typ | Farbe | Verwendung |
|-----------|-------|------------|
| `danger` (rot) | Kritisch | Chat, Apps (ungelesen, offen) |
| `warning` (orange) | Warnung | Admin (fehlende Daten) |
| `success` (grün) | Erfolg | (noch nicht verwendet) |

## Best Practices

### ✅ DO

1. **Backend-Call beim App-Start**
   ```typescript
   // In app.component.ts ngOnInit()
   this.yourService.loadBadgeCounts().subscribe();
   ```

2. **Dedicated loadBadgeCounts() Methode**
   ```typescript
   loadBadgeCounts(): Observable<void> {
     return this.http.get<Data[]>(url).pipe(
       tap(data => {
         const count = this.calculateCount(data);
         this.badgeService.setBadge('source', count);
       }),
       map(() => void 0)
     );
   }
   ```

3. **Updates nach CRUD-Operationen**
   ```typescript
   updateItem(id, data) {
     return this.http.put(url, data).pipe(
       tap(() => this.updateBadgeCount())
     );
   }
   ```

4. **Observable für dynamische Badges**
   ```typescript
   badge$: this.badgeService.getBadge('source')
   ```

### ❌ DON'T

1. **Kein Frontend-Only Badge** (ohne Backend-Call)
   ```typescript
   // ❌ Falsch - Badge wird nicht beim Reload geladen
   constructor() {
     effect(() => {
       this.badgeService.setBadge('source', this.data().length);
     });
   }
   ```

2. **Kein direktes Signal verwenden**
   ```typescript
   // ❌ Falsch - Template updated nicht
   badge: this.badgeService.badges$().users
   
   // ✅ Richtig - Observable
   badge$: this.badgeService.getBadge('users')
   ```

3. **Keine Duplikate bei App-Start**
   ```typescript
   // ❌ Falsch - Doppelter Backend-Call
   ngOnInit() {
     this.service.loadBadgeCounts().subscribe();
     this.service.loadData(); // Lädt auch im Constructor
   }
   ```

## Neues Badge-Modul hinzufügen

### 1. Badge-State erweitern
```typescript
// badge.service.ts
export interface BadgeState {
  // ...existing
  myModule: number;
}

private badgeState = new BehaviorSubject<BadgeState>({
  // ...existing
  myModule: 0
});
```

### 2. Service erstellen/erweitern
```typescript
// my-module.service.ts
@Injectable({ providedIn: 'root' })
export class MyModuleService {
  private badgeService = inject(BadgeService);
  
  loadBadgeCounts(): Observable<void> {
    return this.http.get<MyData[]>('/api/mymodule/').pipe(
      tap(data => {
        const count = data.filter(item => item.needsAttention).length;
        this.badgeService.setBadge('myModule', count);
        console.log(`📊 MyModule-Badges: ${count}`);
      }),
      map(() => void 0),
      catchError(err => {
        console.error('Badge-Load Fehler:', err);
        return of(void 0);
      })
    );
  }
  
  private updateBadgeCount(): void {
    const count = this.items().filter(i => i.needsAttention).length;
    this.badgeService.setBadge('myModule', count);
  }
}
```

### 3. App-Component erweitern
```typescript
// app.component.ts
ngOnInit() {
  // ...existing
  this.myModuleService.loadBadgeCounts().subscribe();
}
```

### 4. UI einbinden
```html
<!-- Navigation -->
<ion-item [routerLink]="['/mymodule']">
  <ion-label>My Module</ion-label>
  @if ((badgeService.getBadge('myModule') | async) ?? 0; as count) {
    <ion-badge color="danger" slot="end">{{ count }}</ion-badge>
  }
</ion-item>

<!-- Kachel -->
{
  id: 'mymodule',
  title: 'My Module',
  badge$: this.badgeService.getBadge('myModule')
}
```

## Debugging

### Console-Logs
Alle Badge-Updates loggen:
```
📊 Arbeitsschein-Badges: 5 offen + 3 zur Abrechnung = 8
👥 Benutzer-Badges: 2 ohne Vorgesetzten
💬 Chat-Badges: 7 ungelesen
```

### Browser DevTools
```javascript
// In Console
angular.getComponent(document.querySelector('app-root'))
  .badgeService.badges$
  .subscribe(badges => console.table(badges));
```

### Häufige Probleme

**Problem:** Badge erscheint nicht beim Reload
- **Ursache:** Kein Backend-Call in `app.component.ts`
- **Lösung:** `loadBadgeCounts()` in `ngOnInit()` aufrufen

**Problem:** Badge updated nicht nach CRUD
- **Ursache:** `updateBadgeCount()` nicht aufgerufen
- **Lösung:** Nach jedem `tap()` in CRUD-Operationen aufrufen

**Problem:** Badge zeigt alte Werte
- **Ursache:** Signal nicht aktualisiert oder falsche Berechnung
- **Lösung:** Computed Signal prüfen, Backend-Response validieren

## Zusammenfassung

**Workflow für Badge-System:**
1. **App-Start** → `app.component.ts` ruft `loadBadgeCounts()` auf
2. **Backend-Call** → Service lädt Daten vom Backend
3. **Badge setzen** → `badgeService.setBadge()` mit berechneter Anzahl
4. **UI Update** → Observable in Template zeigt Badge an
5. **CRUD-Updates** → Nach Änderungen `updateBadgeCount()` aufrufen

**Wichtigste Regel:** Jedes Badge braucht einen **Backend-Call beim App-Start**! Nur Frontend-basierte Badges funktionieren nicht beim Reload.
