import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { WorkOrderService } from '../../../../../core/services/workorder.service';
import { addIcons } from 'ionicons';
import { 
  close, 
  cloudUpload, 
  checkmark, 
  warning,
  createOutline
} from 'ionicons/icons';

interface FieldMapping {
  key: string;
  label: string;
  required: boolean;
  mappedColumn?: string;
}

interface ImportPreview {
  available_columns: string[];
  required_fields: FieldMapping[];
  optional_fields: FieldMapping[];
  auto_mapping: { [key: string]: string };
  preview_data: any[];
  total_rows: number;
  available_sheets?: string[];
  selected_sheet?: string | number;
}

interface SheetSelection {
  available_sheets: string[];
  requires_sheet_selection: boolean;
}

interface ImportResult {
  valid: any[];
  invalid: any[];
  total: number;
}

@Component({
  selector: 'app-checklist-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Hakliste importieren</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      
      <!-- Fortschritts-Schritte -->
      <ion-toolbar>
        <ion-segment [(ngModel)]="currentStep" [disabled]="true">
          <ion-segment-button value="upload">
            <ion-label>1. Datei</ion-label>
          </ion-segment-button>
          <ion-segment-button value="mapping">
            <ion-label>2. Spalten</ion-label>
          </ion-segment-button>
          <ion-segment-button value="validate">
            <ion-label>3. Prüfen</ion-label>
          </ion-segment-button>
          <ion-segment-button value="complete">
            <ion-label>4. Fertig</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      
      <!-- SCHRITT 1: Datei hochladen -->
      @if (currentStep() === 'upload') {
        <div class="upload-section">
          <h2>Excel- oder CSV-Datei hochladen</h2>
          <p>Unterstützte Formate: .xlsx, .xls, .csv</p>
          
          <input 
            #fileInput
            type="file" 
            accept=".xlsx,.xls,.csv"
            (change)="onFileSelected($event)"
            style="display: none">
          
          <ion-button expand="block" (click)="fileInput.click()" [disabled]="isUploading()">
            <ion-icon name="cloud-upload" slot="start"></ion-icon>
            Datei auswählen
          </ion-button>
          
          @if (selectedFile()) {
            <ion-card>
              <ion-card-content>
                <p><strong>Gewählte Datei:</strong> {{ selectedFile()?.name }}</p>
                
                <!-- Sheet-Auswahl (falls mehrere vorhanden) -->
                @if (availableSheets() && availableSheets()!.length > 1) {
                  <ion-item>
                    <ion-label position="stacked">Register auswählen</ion-label>
                    <ion-select 
                      [(ngModel)]="selectedSheet"
                      placeholder="Wähle ein Register..."
                      interface="popover">
                      @for (sheet of availableSheets(); track sheet; let idx = $index) {
                        <ion-select-option [value]="idx">{{ sheet }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                }
                
                <ion-button expand="block" (click)="uploadFile()" [disabled]="isUploading()">
                  @if (isUploading()) {
                    <ion-spinner name="crescent"></ion-spinner>
                  } @else {
                    Weiter
                  }
                </ion-button>
              </ion-card-content>
            </ion-card>
          }
        </div>
      }
      
      <!-- SCHRITT 2: Column Mapping -->
      @if (currentStep() === 'mapping' && preview()) {
        <div class="mapping-section">
          <h2>Spalten zuordnen</h2>
          <p>Ordnen Sie die Spalten aus Ihrer Datei den Feldern zu</p>
          
          <!-- Pflichtfelder -->
          <h3>Pflichtfelder</h3>
          @for (field of preview()!.required_fields; track field.key) {
            <ion-item>
              <ion-label position="stacked">
                {{ field.label }} <ion-text color="danger">*</ion-text>
              </ion-label>
              <ion-select 
                [(ngModel)]="columnMapping()[field.key]"
                placeholder="Spalte wählen..."
                interface="popover">
                <ion-select-option [value]="null">-- Keine --</ion-select-option>
                @for (col of preview()!.available_columns; track col) {
                  <ion-select-option [value]="col">{{ col }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
          }
          
          <!-- Optionale Felder -->
          <h3 class="ion-margin-top">Optionale Felder</h3>
          @for (field of preview()!.optional_fields; track field.key) {
            <ion-item>
              <ion-label position="stacked">{{ field.label }}</ion-label>
              <ion-select 
                [(ngModel)]="columnMapping()[field.key]"
                placeholder="Spalte wählen..."
                interface="popover">
                <ion-select-option [value]="null">-- Keine --</ion-select-option>
                @for (col of preview()!.available_columns; track col) {
                  <ion-select-option [value]="col">{{ col }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
          }
          
          <!-- Globales Startdatum für alle Einträge -->
          @if (!columnMapping()['valid_from']) {
            <ion-card class="ion-margin-top" color="light">
              <ion-card-header>
                <ion-card-subtitle>Startdatum für alle Einträge</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <p>Kein Startdatum in der Datei gefunden. Sie können hier ein gemeinsames Startdatum für alle Einträge festlegen:</p>
                <ion-item>
                  <ion-label position="stacked">Gültig von (für alle)</ion-label>
                  <ion-input 
                    type="date" 
                    [(ngModel)]="globalValidFrom"
                    placeholder="Optional: Startdatum für alle Einträge">
                  </ion-input>
                </ion-item>
                <ion-note class="ion-margin-top">
                  <small>Dieses Datum wird für alle Einträge verwendet. Sie können es im nächsten Schritt noch individuell anpassen.</small>
                </ion-note>
              </ion-card-content>
            </ion-card>
          }
          
          <!-- Vorschau -->
          <h3 class="ion-margin-top">Datenvorschau (erste 5 Zeilen)</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  @for (col of preview()!.available_columns; track col) {
                    <th>{{ col }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of preview()!.preview_data; track $index) {
                  <tr>
                    @for (col of preview()!.available_columns; track col) {
                      <td>{{ row[col] }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          
          <ion-button 
            expand="block" 
            class="ion-margin-top"
            (click)="executeImport()" 
            [disabled]="!isMappingValid()">
            Weiter zur Validierung
          </ion-button>
        </div>
      }
      
      <!-- SCHRITT 3: Validierung & Nachbearbeitung -->
      @if (currentStep() === 'validate' && importResult()) {
        <div class="validate-section">
          <h2>Daten prüfen</h2>
          
          <ion-card color="success" *ngIf="importResult()!.valid.length > 0">
            <ion-card-content>
              <ion-icon name="checkmark" size="large"></ion-icon>
              <strong>{{ importResult()!.valid.length }} gültige Einträge</strong>
              <p class="ion-margin-top">Diese Einträge können importiert werden. Sie können noch Startdaten ergänzen:</p>
            </ion-card-content>
          </ion-card>
          
          <!-- Gültige Einträge mit optionaler Datumsbearbeitung -->
          @if (importResult()!.valid.length > 0) {
            <div class="valid-entries-table ion-margin-top">
              <h3>Gültige Einträge - Startdatum optional ergänzen</h3>
              <div class="table-container" style="max-height: 300px; overflow-y: auto;">
                <table>
                  <thead>
                    <tr>
                      <th>O-Nummer</th>
                      <th>P-Nummer</th>
                      <th>Objektbeschreibung</th>
                      <th>Startdatum</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of importResult()!.valid; track item.row_number) {
                      <tr>
                        <td>{{ item.object_number }}</td>
                        <td>{{ item.project_number }}</td>
                        <td>{{ item.object_description }}</td>
                        <td>
                          <ion-input 
                            type="date"
                            [(ngModel)]="item.valid_from"
                            placeholder="Optional">
                          </ion-input>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
          
          @if (importResult()!.invalid.length > 0) {
            <ion-card color="warning">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon name="warning"></ion-icon>
                  {{ importResult()!.invalid.length }} Einträge mit fehlenden Pflichtfeldern
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p>Bitte ergänzen Sie die fehlenden Daten:</p>
              </ion-card-content>
            </ion-card>
            
            <!-- Tabelle zur Nachbearbeitung -->
            <div class="editable-table">
              <table>
                <thead>
                  <tr>
                    <th>Zeile</th>
                    <th>O-Nummer *</th>
                    <th>P-Nummer *</th>
                    <th>Objektbeschreibung *</th>
                    <th>Startdatum</th>
                    <th>Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of importResult()!.invalid; track item.row_number) {
                    <tr>
                      <td>{{ item.row_number }}</td>
                      <td>
                        <ion-input 
                          [(ngModel)]="item.object_number"
                          placeholder="O-123456"
                          (ionChange)="validateRow(item)">
                        </ion-input>
                      </td>
                      <td>
                        <ion-input 
                          [(ngModel)]="item.project_number"
                          placeholder="P1234567"
                          (ionChange)="validateRow(item)">
                        </ion-input>
                      </td>
                      <td>
                        <ion-input 
                          [(ngModel)]="item.object_description"
                          placeholder="Beschreibung..."
                          (ionChange)="validateRow(item)">
                        </ion-input>
                      </td>
                      <td>
                        <ion-input 
                          type="date"
                          [(ngModel)]="item.valid_from"
                          placeholder="Optional">
                        </ion-input>
                      </td>
                      <td>
                        <ion-text color="danger">
                          {{ item.missing_fields?.join(', ') }}
                        </ion-text>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          
          <ion-button 
            expand="block" 
            class="ion-margin-top"
            (click)="saveImport()"
            [disabled]="isSaving() || hasInvalidRows()">
            @if (isSaving()) {
              <ion-spinner name="crescent"></ion-spinner>
              Speichere...
            } @else {
              <ion-icon name="checkmark" slot="start"></ion-icon>
              Import abschließen ({{ getTotalValidRows() }} Einträge)
            }
          </ion-button>
        </div>
      }
      
      <!-- SCHRITT 4: Abschluss -->
      @if (currentStep() === 'complete' && saveResult()) {
        <div class="complete-section">
          <ion-icon name="checkmark" color="success" style="font-size: 64px;"></ion-icon>
          <h2>Import erfolgreich!</h2>
          
          <ion-card>
            <ion-card-content>
              <p><strong>{{ saveResult()!.created }}</strong> neue Einträge erstellt</p>
              <p><strong>{{ saveResult()!.updated }}</strong> Einträge aktualisiert</p>
              @if (saveResult()!.errors.length > 0) {
                <p><ion-text color="danger"><strong>{{ saveResult()!.errors.length }}</strong> Fehler</ion-text></p>
              }
            </ion-card-content>
          </ion-card>
          
          <ion-button expand="block" (click)="dismiss(true)">
            Schließen
          </ion-button>
        </div>
      }
      
    </ion-content>
  `,
  styles: [`
    .upload-section, .mapping-section, .validate-section, .complete-section {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .table-container {
      overflow-x: auto;
      margin-top: 1rem;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    th, td {
      padding: 8px;
      border: 1px solid var(--ion-color-step-150);
      text-align: left;
    }
    
    th {
      background: var(--ion-color-step-100);
      font-weight: bold;
      position: sticky;
      top: 0;
    }
    
    .editable-table ion-input {
      --background: white;
      --padding-start: 8px;
      --padding-end: 8px;
    }
    
    .complete-section {
      text-align: center;
      padding: 2rem;
    }
    
    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 1rem;
    }
  `]
})
export class ChecklistImportModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private workOrderService = inject(WorkOrderService);

  currentStep = signal<'upload' | 'mapping' | 'validate' | 'complete'>('upload');
  selectedFile = signal<File | null>(null);
  isUploading = signal(false);
  isSaving = signal(false);
  
  availableSheets = signal<string[] | null>(null);
  selectedSheet: number | string = 0;
  
  preview = signal<ImportPreview | null>(null);
  columnMapping = signal<{ [key: string]: string }>({});
  globalValidFrom = signal<string>(''); // Globales Startdatum für alle Einträge
  importResult = signal<ImportResult | null>(null);
  saveResult = signal<any>(null);

  constructor() {
    addIcons({ close, cloudUpload, checkmark, warning, createOutline });
  }

  ngOnInit() {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
      
      // Für Excel-Dateien: Prüfe verfügbare Sheets
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        this.detectSheets(file);
      } else {
        this.availableSheets.set(null);
      }
    }
  }

  async detectSheets(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheet_name', 'detect');

    this.workOrderService.checklistImportPreview(formData).subscribe({
      next: (response) => {
        if (response.available_sheets && response.requires_sheet_selection) {
          this.availableSheets.set(response.available_sheets);
        } else {
          this.availableSheets.set(null);
        }
      },
      error: (err) => {
        console.error('Error detecting sheets:', err);
        this.availableSheets.set(null);
      }
    });
  }

  async uploadFile() {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sheet-Name mitgeben, falls vorhanden
    if (this.availableSheets() && this.availableSheets()!.length > 1) {
      formData.append('sheet_name', this.selectedSheet.toString());
    }

    this.workOrderService.checklistImportPreview(formData).subscribe({
      next: (response) => {
        this.preview.set(response);
        this.columnMapping.set(response.auto_mapping);
        this.currentStep.set('mapping');
        this.isUploading.set(false);
      },
      error: async (err) => {
        this.isUploading.set(false);
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: err.error?.error || 'Fehler beim Lesen der Datei',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  isMappingValid(): boolean {
    const mapping = this.columnMapping();
    const preview = this.preview();
    if (!preview) return false;

    // Prüfe ob alle Pflichtfelder gemappt sind
    for (const field of preview.required_fields) {
      if (!mapping[field.key]) {
        return false;
      }
    }
    return true;
  }

  async executeImport() {
    const file = this.selectedFile();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('column_mapping', JSON.stringify(this.columnMapping()));
    
    // Globales Startdatum mitgeben, falls vorhanden
    if (this.globalValidFrom()) {
      formData.append('global_valid_from', this.globalValidFrom());
    }
    
    // Sheet-Name mitgeben, falls vorhanden
    if (this.availableSheets() && this.availableSheets()!.length > 1) {
      formData.append('sheet_name', this.selectedSheet.toString());
    }

    this.isUploading.set(true);

    this.workOrderService.checklistImportExecute(formData).subscribe({
      next: (response) => {
        this.importResult.set(response.import_results);
        this.currentStep.set('validate');
        this.isUploading.set(false);
      },
      error: async (err) => {
        this.isUploading.set(false);
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: err.error?.error || 'Fehler beim Import',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  validateRow(item: any) {
    // Prüfe Pflichtfelder
    const missing: string[] = [];
    if (!item.object_number) missing.push('O-Nummer');
    if (!item.project_number) missing.push('P-Nummer');
    if (!item.object_description) missing.push('Objektbeschreibung');
    
    item.missing_fields = missing;
    
    // Wenn alle Felder gefüllt, verschiebe zu valid
    if (missing.length === 0) {
      const result = this.importResult();
      if (result) {
        const invalidIndex = result.invalid.findIndex(i => i.row_number === item.row_number);
        if (invalidIndex !== -1) {
          result.invalid.splice(invalidIndex, 1);
          result.valid.push(item);
          this.importResult.set({...result});
        }
      }
    }
  }

  hasInvalidRows(): boolean {
    const result = this.importResult();
    return result ? result.invalid.length > 0 : false;
  }

  getTotalValidRows(): number {
    const result = this.importResult();
    return result ? result.valid.length : 0;
  }

  async saveImport() {
    const result = this.importResult();
    if (!result) return;

    this.isSaving.set(true);

    this.workOrderService.checklistImportSave(result.valid).subscribe({
      next: (response) => {
        this.saveResult.set(response);
        this.currentStep.set('complete');
        this.isSaving.set(false);
      },
      error: async (err) => {
        this.isSaving.set(false);
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: err.error?.error || 'Fehler beim Speichern',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  dismiss(refresh = false) {
    this.modalCtrl.dismiss({ refresh });
  }
}
