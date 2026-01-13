# Arbeitsscheine - Neue Features

## Übersicht

Die Arbeitsschein-Verwaltung wurde um folgende Features erweitert:

### 1. **Duplikat-Erkennung** ✅
- Automatische Erkennung beim Einreichen
- Prüft O-Nummer, P-Nummer und Datum
- Findet auch bereits abgerechnete Arbeitsscheine
- Warnung in der Liste sichtbar

### 2. **Optimierte Dateinamen** ✅
- Format: `O-Nr_P-Nr_Datum.pdf`
- Beispiel: `O-12345_P-67890_2026-01-05.pdf`
- Wird automatisch beim Upload generiert

### 3. **Hakliste für wiederkehrende Arbeitsscheine** ✅
- Nur für Faktur-Mitarbeiter
- Stammdaten-Verwaltung
- Monatliches Tracking

**Felder:**
- O-Nummer (Pflichtfeld)
- Objektbeschreibung (Pflichtfeld)
- P-Nummer (Pflichtfeld)
- Debitor-Nr (Optional)
- Bemerkung (Optional - SR-Nummer wird automatisch erkannt)

**SR-Nummern:**
- Automatische Erkennung: "SR-123" in Bemerkungen
- Ermöglicht Sammelrechnungen
- Zusammenführung mehrerer PDFs

### 4. **Download-Tracking** ✅
- Markierung wenn PDF heruntergeladen wurde
- Zwischenschritt vor "Abgerechnet"
- Sichtbar in der Liste

### 5. **Bulk-Operationen** ✅
- Checkboxen zur Mehrfachauswahl
- Bulk-Download-Markierung
- SR-Rechnungen zusammenführen
- Mehrere PDFs einzeln downloaden

## Frontend-Komponenten

### Neue Seiten
1. **Hakliste** (`/apps/workorders/checklist`)
   - Verwaltung wiederkehrender Arbeitsscheine
   - Filter: Alle / Nicht abgehakt / SR-Rechnungen
   - Suche nach O-Nr, P-Nr, Beschreibung
   - Abhaken für aktuellen Monat

### Neue Komponenten
1. **WorkorderListWithBulkComponent**
   - Erweiterte Liste mit Checkboxen
   - Duplikat-Warnung
   - SR-Nummer-Anzeige
   - Download-Status
   - Bulk-Aktionen-Toolbar

2. **ChecklistEditModalComponent**
   - Bearbeiten/Erstellen von Haklisten-Einträgen
   - Validierung der Pflichtfelder
   - Auto-Extraktion der SR-Nummer

## API-Endpoints

### Duplikat & Download
```
POST /api/workorders/orders/{id}/check_duplicate/
POST /api/workorders/orders/{id}/mark_downloaded/
POST /api/workorders/orders/bulk_download/
POST /api/workorders/orders/merge_pdfs/
```

### Hakliste
```
GET    /api/workorders/checklist/
POST   /api/workorders/checklist/
GET    /api/workorders/checklist/{id}/
PUT    /api/workorders/checklist/{id}/
DELETE /api/workorders/checklist/{id}/
POST   /api/workorders/checklist/{id}/check/
POST   /api/workorders/checklist/{id}/uncheck/
GET    /api/workorders/checklist/unchecked/
GET    /api/workorders/checklist/by_sr_number/?sr_number=SR-123
```

## Workflow

### Arbeitsschein einreichen
1. User scannt Arbeitsschein
2. OCR erkennt O-Nr und P-Nr
3. Beim Submit:
   - Duplikat-Check wird automatisch durchgeführt
   - Haklisten-Abgleich erfolgt
   - Optimierter Dateiname wird generiert

### Faktur-Mitarbeiter Workflow
1. **Eingereichte Liste öffnen**
   - Sieht Duplikat-Warnungen
   - Sieht SR-Nummer-Chips
   - Sieht Download-Status

2. **Bulk-Operationen**
   - Checkboxen für Auswahl
   - "Als heruntergeladen markieren"
   - SR-PDFs zusammenführen

3. **Hakliste pflegen**
   - Monatlich zurücksetzen (automatisch)
   - Einträge abhaken wenn bearbeitet
   - SR-Nummern in Bemerkungen pflegen

### Sammelrechnungen (SR)
1. Haklisten-Einträge mit gleicher SR-Nummer anlegen
2. Arbeitsscheine werden automatisch zugeordnet
3. In Eingereichten-Liste: Mehrere mit gleicher SR-Nummer auswählen
4. "SR-PDFs zusammenführen" → Eine PDF mit allen Scheinen
5. Automatische Download-Markierung

## Verwendung im Code

### WorkOrderService Beispiele

```typescript
// Duplikat prüfen
this.workorderService.checkDuplicate(workorderId).subscribe(result => {
  console.log('Is duplicate:', result.is_duplicate);
  console.log('Duplicates:', result.duplicates);
});

// Als heruntergeladen markieren
this.workorderService.markDownloaded(workorderId).subscribe();

// Bulk-Download-Markierung
this.workorderService.bulkMarkDownloaded([1, 2, 3]).subscribe();

// SR-PDFs zusammenführen
this.workorderService.mergePdfs([1, 2, 3], 'SR-123').subscribe(blob => {
  // Download blob as PDF
});

// Hakliste laden
this.workorderService.loadChecklistItems().subscribe();

// Eintrag abhaken
this.workorderService.checkChecklistItem(itemId).subscribe();

// Nach SR-Nummer filtern
this.workorderService.getChecklistItemsBySrNumber('SR-123').subscribe();
```

### WorkorderListWithBulkComponent Beispiel

```html
<app-workorder-list-with-bulk
  [workorders]="billingWorkOrders()"
  (viewOrder)="viewWorkOrder($event)">
</app-workorder-list-with-bulk>
```

## Berechtigungen

- **Hakliste**: Nur für Faktur-Mitarbeiter
- **Bulk-Operationen**: Alle authentifizierten Benutzer
- **Duplikat-Check**: Automatisch beim Einreichen

## Nächste Schritte

1. Bulk-Upload-Modal anpassen um neue Komponente zu nutzen
2. Haupt-Workorders-Seite erweitern mit Bulk-Liste
3. Navigation zur Hakliste hinzufügen
4. Monatlichen Cron-Job für Haklisten-Reset einrichten
5. Tests schreiben

## Hinweise

- **Migration erforderlich**: `0009_workorder_duplicate_checked_at_and_more.py`
- **PyPDF2 installiert**: Für PDF-Zusammenführung
- **SR-Nummern Format**: "SR-123" (Groß-/Kleinschreibung egal)
- **Optimierter Dateiname**: Wird von `get_optimized_filename()` generiert
