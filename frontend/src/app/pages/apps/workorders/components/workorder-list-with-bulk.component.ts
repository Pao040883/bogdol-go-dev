import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { WorkOrder } from '../../../../core/interfaces/workorder.types';
import { WorkOrderService } from '../../../../core/services/workorder.service';
import { UserFeaturesService } from '../../../../services/user-features.service';
import { addIcons } from 'ionicons';
import { downloadOutline, folderOpenOutline } from 'ionicons/icons';

@Component({
  selector: 'app-workorder-list-with-bulk',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="bulk-actions-toolbar" *ngIf="selectedOrders().length > 0 && canDownload()">
      <div class="selection-info">
        <ion-checkbox 
          [checked]="allSelected()"
          [indeterminate]="someSelected()"
          (ionChange)="toggleSelectAll()">
        </ion-checkbox>
        <span>{{ selectedOrders().length }} ausgewählt</span>
      </div>
      
      <div class="actions">
        <ion-button size="small" fill="clear" (click)="bulkMarkDownloaded()">
          <ion-icon name="checkmark-done-outline" slot="start"></ion-icon>
          Als heruntergeladen markieren
        </ion-button>
        
        <ion-button size="small" fill="clear" color="success" (click)="bulkMarkBilled()">
          <ion-icon name="cash-outline" slot="start"></ion-icon>
          Als abgerechnet markieren
        </ion-button>
        
        @if (hasMultiplePdfs()) {
          <ion-button size="small" fill="clear" (click)="downloadMergedPdfAll()">
            <ion-icon name="download-outline" slot="start"></ion-icon>
            PDFs zusammenführen ({{ selectedPdfCount() }})
          </ion-button>
        }
        
        @if (hasSrNumbers()) {
          <ion-button size="small" fill="clear" (click)="downloadMergedPdf()">
            <ion-icon name="documents-outline" slot="start"></ion-icon>
            SR-PDFs zusammenführen
          </ion-button>
        }
        
        <ion-button size="small" fill="clear" (click)="clearSelection()">
          <ion-icon name="close" slot="icon-only"></ion-icon>
        </ion-button>
      </div>
    </div>

    <ion-list>
      @for (wo of workorders; track wo.id) {
        <ion-item>
          @if (canDownload()) {
            <ion-checkbox 
              slot="start"
              [checked]="isSelected(wo)"
              (ionChange)="toggleSelect(wo)">
            </ion-checkbox>
          }
          
          <ion-label (click)="viewOrder.emit(wo)" class="clickable">
            <h2>
              <strong>{{ wo.order_number }}</strong>
              @if (wo.is_duplicate) {
                <ion-chip color="warning" style="margin-left: 8px; height: 22px;">
                  <ion-icon name="alert-circle-outline" style="font-size: 14px;"></ion-icon>
                  <ion-label style="font-size: 11px; margin-left: 4px;">DUPLIKAT</ion-label>
                </ion-chip>
              }
              @if (wo.checklist_match?.sr_invoice_number) {
                <ion-chip color="primary" style="margin-left: 8px; height: 22px;">
                  <ion-icon name="documents-outline" style="font-size: 12px;"></ion-icon>
                  <ion-label style="font-size: 11px; margin-left: 2px;">{{ wo.checklist_match?.sr_invoice_number }}</ion-label>
                </ion-chip>
              }
              @if (wo.pdf_downloaded) {
                <ion-chip color="success" style="margin-left: 8px; height: 22px;">
                  <ion-icon name="checkmark-circle" style="font-size: 14px;"></ion-icon>
                  <ion-label style="font-size: 11px; margin-left: 4px;">Heruntergeladen</ion-label>
                </ion-chip>
              }
            </h2>
            <h3>{{ wo.client_name }}</h3>
            <p>
              O-Nr: {{ wo.object_number || '-' }} | P-Nr: {{ wo.project_number || '-' }}
              @if (wo.leistungsmonat) {
                <span> | Monat: {{ formatMonth(wo.leistungsmonat) }}</span>
              }
            </p>
            @if (wo.is_duplicate && wo.duplicate_of_details) {
              <p class="duplicate-info">
                <ion-icon name="warning-outline"></ion-icon>
                Duplikat von {{ wo.duplicate_of_details.order_number }} 
                ({{ formatStatus(wo.duplicate_of_details.status) }})
              </p>
            }
            @if (wo.checklist_match) {
              <p class="checklist-info">
                <ion-icon [name]="wo.checklist_match.checked_this_month ? 'checkmark-circle' : 'checkbox-outline'"></ion-icon>
                <span>
                  Hakliste: {{ wo.checklist_match.checked_this_month ? 'Abgehakt ✓' : 'Noch offen' }}
                  @if (wo.checklist_match.sr_invoice_number) {
                    <strong>({{ wo.checklist_match.sr_invoice_number }})</strong>
                  }
                  @if (wo.checklist_match.notes) {
                    · {{ wo.checklist_match.notes }}
                  }
                </span>
              </p>
              @if (wo.checklist_match.service_manager) {
                <p class="checklist-manager">
                  <ion-icon name="person-outline"></ion-icon>
                  Service: {{ wo.checklist_match.service_manager.full_name }}
                </p>
              }
            }
            <p class="dates">
              Eingereicht: {{ formatDate(wo.submitted_at) }}
              @if (wo.submitted_by_details) {
                von {{ wo.submitted_by_details.full_name }}
              }
            </p>
          </ion-label>
          
          @if (canDownload()) {
            <ion-button 
              slot="end" 
              fill="clear" 
              (click)="downloadSingle(wo)"
              [disabled]="!wo.scanned_document">
              <ion-icon name="download-outline" slot="icon-only"></ion-icon>
            </ion-button>
          }
        </ion-item>
      }
    </ion-list>

    @if (workorders.length === 0) {
      <div class="empty-state">
        <ion-icon name="folder-open-outline" size="large"></ion-icon>
        <p>Keine Arbeitsscheine vorhanden</p>
      </div>
    }
  `,
  styles: [`
    .bulk-actions-toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--ion-color-primary);
      color: white;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      
      .selection-info {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 500;
        
        ion-checkbox {
          --border-color: white;
          --checkmark-color: var(--ion-color-primary);
          --background-checked: white;
        }
      }
      
      .actions {
        display: flex;
        gap: 8px;
        
        ion-button {
          --color: white;
          font-size: 13px;
        }
      }
    }

    ion-label.clickable {
      cursor: pointer;
      
      h2 {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 8px;
        
        strong {
          font-size: 16px;
          color: var(--ion-color-primary);
        }
      }
      
      h3 {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 6px;
      }
      
      p {
        font-size: 13px;
        color: var(--ion-color-medium);
        margin: 4px 0;
        
        &.duplicate-info {
          color: var(--ion-color-warning);
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          
          ion-icon {
            font-size: 16px;
          }
        }
        
        &.checklist-info {
          color: var(--ion-color-success);
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          
          ion-icon {
            font-size: 16px;
          }
          
          strong {
            color: var(--ion-color-primary);
          }
        }
        
        &.checklist-manager {
          color: var(--ion-color-medium);
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          
          ion-icon {
            font-size: 14px;
          }
        }
        
        &.dates {
          font-size: 12px;
          color: var(--ion-color-step-600);
        }
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      
      ion-icon {
        color: var(--ion-color-medium);
        margin-bottom: 16px;
      }
      
      p {
        color: var(--ion-color-medium);
        font-size: 16px;
      }
    }
  `]
})
export class WorkorderListWithBulkComponent {
  @Input() workorders: WorkOrder[] = [];
  @Output() viewOrder = new EventEmitter<WorkOrder>();

  private workorderService = inject(WorkOrderService);
  private userFeatures = inject(UserFeaturesService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({ 'download-outline': downloadOutline, 'folder-open-outline': folderOpenOutline });
  }

  selectedOrders = signal<WorkOrder[]>([]);
  
  canDownload = computed(() => {
    return this.userFeatures.features()?.can_download_workorder_pdf || false;
  });

  allSelected = computed(() => {
    const selected = this.selectedOrders();
    return this.workorders.length > 0 && selected.length === this.workorders.length;
  });

  someSelected = computed(() => {
    const selected = this.selectedOrders();
    return selected.length > 0 && selected.length < this.workorders.length;
  });

  hasSrNumbers = computed(() => {
    return this.selectedOrders().some(wo => !!wo.checklist_match?.sr_invoice_number);
  });

  hasMultiplePdfs = computed(() => {
    const withPdfs = this.selectedOrders().filter(wo => !!wo.scanned_document);
    return withPdfs.length > 1;
  });

  selectedPdfCount = computed(() => {
    return this.selectedOrders().filter(wo => !!wo.scanned_document).length;
  });

  isSelected(wo: WorkOrder): boolean {
    return this.selectedOrders().some(selected => selected.id === wo.id);
  }

  toggleSelect(wo: WorkOrder) {
    if (this.isSelected(wo)) {
      this.selectedOrders.update(list => list.filter(item => item.id !== wo.id));
    } else {
      this.selectedOrders.update(list => [...list, wo]);
    }
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedOrders.set([]);
    } else {
      this.selectedOrders.set([...this.workorders]);
    }
  }

  clearSelection() {
    this.selectedOrders.set([]);
  }

  async bulkMarkDownloaded() {
    const selected = this.selectedOrders();
    if (selected.length === 0) return;

    const ids = selected.map(wo => wo.id!);
    
    this.workorderService.bulkMarkDownloaded(ids).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `${selected.length} Arbeitsscheine als heruntergeladen markiert`,
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        this.clearSelection();
      },
      error: async (err) => {
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: 'Fehler beim Markieren der Arbeitsscheine',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  async downloadMergedPdf() {
    const selected = this.selectedOrders();
    if (selected.length === 0) return;

    // Group by SR number
    const srGroups = new Map<string, WorkOrder[]>();
    selected.forEach(wo => {
      const srNumber = wo.checklist_match?.sr_invoice_number;
      if (srNumber) {
        if (!srGroups.has(srNumber)) {
          srGroups.set(srNumber, []);
        }
        srGroups.get(srNumber)!.push(wo);
      }
    });

    if (srGroups.size === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Keine SR-Nummern',
        message: 'Keine der ausgewählten Arbeitsscheine hat eine SR-Nummer.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // If multiple SR numbers, let user choose
    if (srGroups.size > 1) {
      const alert = await this.alertCtrl.create({
        header: 'SR-Nummer wählen',
        message: 'Mehrere SR-Nummern gefunden. Welche möchten Sie zusammenführen?',
        inputs: Array.from(srGroups.entries()).map(([srNumber, orders]) => ({
          type: 'radio',
          label: `${srNumber} (${orders.length} Arbeitsscheine)`,
          value: srNumber
        })),
        buttons: [
          {
            text: 'Abbrechen',
            role: 'cancel'
          },
          {
            text: 'Herunterladen',
            handler: (srNumber: string) => {
              this.downloadMergedForSr(srNumber, srGroups.get(srNumber)!);
            }
          }
        ]
      });
      await alert.present();
    } else {
      // Only one SR number
      const [srNumber, orders] = Array.from(srGroups.entries())[0];
      this.downloadMergedForSr(srNumber, orders);
    }
  }
  
  async downloadMergedPdfAll() {
    const selected = this.selectedOrders();
    const withPdfs = selected.filter(wo => !!wo.scanned_document);
    
    if (withPdfs.length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Keine PDFs',
        message: 'Keine der ausgewählten Arbeitsscheine hat ein PDF.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }
    
    if (withPdfs.length === 1) {
      // Only one PDF - download directly
      this.downloadSingle(withPdfs[0]);
      return;
    }
    
    // Multiple PDFs - merge them
    const ids = withPdfs.map(wo => wo.id!);
    const filename = `Zusammengefasst_${withPdfs.length}_Arbeitsscheine.pdf`;
    
    this.workorderService.mergePdfs(ids).subscribe({
      next: async (blob) => {
        // Download the merged PDF
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);

        const toast = await this.toastCtrl.create({
          message: `${withPdfs.length} PDFs zusammengeführt und heruntergeladen`,
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        
        this.clearSelection();
      },
      error: async (err) => {
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: 'Fehler beim Zusammenführen der PDFs',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  private downloadMergedForSr(srNumber: string, orders: WorkOrder[]) {
    const ids = orders.map(wo => wo.id!);
    
    this.workorderService.mergePdfs(ids, srNumber).subscribe({
      next: async (blob) => {
        // Download the merged PDF
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${srNumber}_Sammelrechnung.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);

        const toast = await this.toastCtrl.create({
          message: `${srNumber} Sammelrechnung heruntergeladen`,
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        
        this.clearSelection();
      },
      error: async (err) => {
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: 'Fehler beim Zusammenführen der PDFs',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  downloadSingle(wo: WorkOrder) {
    if (!wo.scanned_document || !wo.id) return;

    // Download as file instead of opening in new window
    fetch(wo.scanned_document)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${wo.order_number}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        // Mark as downloaded
        this.workorderService.markDownloaded(wo.id!).subscribe({
          next: async () => {
            const toast = await this.toastCtrl.create({
              message: 'Als heruntergeladen markiert',
              duration: 1500,
              color: 'success'
            });
            await toast.present();
          }
        });
      })
      .catch(async (error) => {
        console.error('Download error:', error);
        const alert = await this.alertCtrl.create({
          header: 'Fehler',
          message: 'Fehler beim Herunterladen der Datei',
          buttons: ['OK']
        });
        await alert.present();
      });
  }
  
  async bulkMarkBilled() {
    const selected = this.selectedOrders();
    if (selected.length === 0) return;

    const confirm = await this.alertCtrl.create({
      header: 'Bestätigung',
      message: `${selected.length} Arbeitsscheine als abgerechnet markieren?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Ja, abrechnen',
          handler: () => {
            const ids = selected.map(wo => wo.id!);
            
            this.workorderService.bulkMarkBilled(ids).subscribe({
              next: async (response) => {
                let message = `${response.updated_count} Arbeitsscheine als abgerechnet markiert`;
                if (response.errors && response.errors.length > 0) {
                  message += `\n\nFehler bei ${response.errors.length} Arbeitsscheinen`;
                }
                
                const toast = await this.toastCtrl.create({
                  message: message,
                  duration: 3000,
                  color: response.errors && response.errors.length > 0 ? 'warning' : 'success'
                });
                await toast.present();
                this.clearSelection();
              },
              error: async (err) => {
                const alert = await this.alertCtrl.create({
                  header: 'Fehler',
                  message: 'Fehler beim Abrechnen der Arbeitsscheine',
                  buttons: ['OK']
                });
                await alert.present();
              }
            });
          }
        }
      ]
    });
    await confirm.present();
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatMonth(monthString: string | undefined): string {
    if (!monthString) return '-';
    // Format: "2025-12" -> "Dez 2025"
    const [year, month] = monthString.split('-');
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  }

  formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'draft': 'Entwurf',
      'in_progress': 'In Bearbeitung',
      'completed': 'Abgeschlossen',
      'signed': 'Unterschrieben',
      'submitted': 'Eingereicht',
      'billed': 'Abgerechnet',
      'cancelled': 'Storniert'
    };
    return statusMap[status] || status;
  }
}
