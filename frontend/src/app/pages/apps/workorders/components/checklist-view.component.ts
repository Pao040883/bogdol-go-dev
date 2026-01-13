import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController, ViewWillEnter, ViewDidLeave, NavController } from '@ionic/angular';
import { WorkOrderService } from '../../../../core/services/workorder.service';
import { RecurringWorkOrderChecklist } from '../../../../core/interfaces/workorder.types';
import { UserFeaturesService } from '../../../../services/user-features.service';
import { addIcons } from 'ionicons';
import { addOutline, refreshOutline, checkmarkCircle, settingsOutline, syncOutline, eye, eyeOff, link } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-checklist-view',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="checklist-header">
      
      <div class="header-actions">
        <ion-button size="small" fill="outline" (click)="refreshChecklist()">
          <ion-icon name="refresh-outline" slot="start"></ion-icon>
          Aktualisieren
        </ion-button>
        
        <ion-button size="small" fill="outline" color="primary" (click)="syncWithMasterData()">
          <ion-icon name="sync-outline" slot="start"></ion-icon>
          Jetzt synchronisieren
        </ion-button>
        
        @if (canManageChecklist()) {
          <ion-button size="small" (click)="navigateToMasterData()">
            <ion-icon name="settings-outline" slot="start"></ion-icon>
            Stammdaten verwalten
          </ion-button>
        }
      </div>
    </div>
    
    @if (canViewAllItems()) {
      <div class="toggle-section">
        <ion-chip 
          [color]="showAll() ? 'primary' : 'medium'"
          (click)="toggleShowAll()"
          style="cursor: pointer;">
          <ion-icon [name]="showAll() ? 'eye' : 'eye-off'" slot="start"></ion-icon>
          <ion-label>{{ showAll() ? 'Alle Einträge anzeigen' : 'Nur meine Einträge' }}</ion-label>
        </ion-chip>
      </div>
    }

    @if (isLoading()) {
      <div class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Lade Hakliste...</p>
      </div>
    } @else {
      <!-- Statistik -->
      <div class="stats-cards">
        <div class="stat-card" [class.active]="filterStatus() === 'all'" (click)="setFilter('all')">
          <div class="stat-value">{{ totalItems }}</div>
          <div class="stat-label">Gesamt</div>
        </div>
        <div class="stat-card success" [class.active]="filterStatus() === 'checked'" (click)="setFilter('checked')">
          <div class="stat-value">{{ checkedItems }}</div>
          <div class="stat-label">Abgehakt</div>
        </div>
        <div class="stat-card warning" [class.active]="filterStatus() === 'unchecked'" (click)="setFilter('unchecked')">
          <div class="stat-value">{{ uncheckedItems }}</div>
          <div class="stat-label">Offen</div>
        </div>
      </div>

      <!-- Checklist Items -->
      <ion-list>
        <ion-list-header>
          <ion-label>Einträge ({{ filteredItems().length }})</ion-label>
        </ion-list-header>

        @for (item of filteredItems(); track item.id) {
          <ion-item>
            <ion-checkbox 
              slot="start" 
              [checked]="item.checked_this_month"
              disabled>
            </ion-checkbox>
            
            <div class="checklist-item-content">
              <div class="item-header">
                <h3>
                  @if (item.sr_invoice_number) {
                    <ion-chip color="primary" size="small">
                      SR-{{ item.sr_invoice_number }}
                    </ion-chip>
                  }
                  {{ item.object_description }}
                </h3>
              </div>
              
              <p class="item-details">
                <strong>O-Nr:</strong> {{ item.object_number }} | 
                <strong>P-Nr:</strong> {{ item.project_number }}
              </p>
              
              @if (item.object_description) {
                <p class="item-description">{{ item.object_description }}</p>
              }
              
              @if (item.checked_this_month && item.last_checked_at) {
                <p class="item-checked-info">
                  <ion-icon name="checkmark-circle"></ion-icon>
                  Abgehakt am {{ formatDate(item.last_checked_at) }}
                </p>
              }
              
              @if (item.matching_workorders_count && item.matching_workorders_count > 0) {
                <p class="item-matched">
                  <ion-icon name="link"></ion-icon>
                  {{ item.matching_workorders_count }} Arbeitsschein(e) gefunden
                </p>
              }
            </div>
          </ion-item>
        } @empty {
          <div class="empty-state">
            <ion-icon name="checkbox-outline" size="large"></ion-icon>
            <p>Keine Einträge für diesen Monat</p>
            <p class="info-text">Die Hakliste wird automatisch zum Monatswechsel aus den Stammdaten gefüllt.</p>
            <ion-button (click)="navigateToMasterData()">
              <ion-icon name="settings-outline" slot="start"></ion-icon>
              Stammdaten verwalten
            </ion-button>
          </div>
        }
      </ion-list>
    }
  `,
  styles: [`
    .checklist-header {
      padding: 16px;
      background: var(--ion-color-light);
      border-bottom: 1px solid var(--ion-color-light-shade);
      
      .header-info {
        margin-bottom: 12px;
        
        h2 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 600;
        }
        
        p {
          margin: 0;
          color: var(--ion-color-medium);
          font-size: 14px;
        }
      }
      
      .header-actions {
        display: flex;
        gap: 8px;
      }
    }
    
    .toggle-section {
      padding: 12px 16px;
      background: var(--ion-color-light);
      border-bottom: 1px solid var(--ion-color-light-shade);
    }

    .stats-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 12px 16px;
      
      .stat-card {
        background: var(--ion-color-light);
        border-radius: 6px;
        padding: 12px;
        text-align: center;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        
        &:hover {
          background: var(--ion-color-light-shade);
          transform: translateY(-2px);
        }
        
        &.active {
          border-color: var(--ion-color-primary);
          background: var(--ion-color-primary-tint);
        }
        
        &.success {
          background: var(--ion-color-success-tint);
          
          &.active {
            border-color: var(--ion-color-success);
            background: var(--ion-color-success-shade);
          }
        }
        
        &.warning {
          background: var(--ion-color-warning-tint);
          
          &.active {
            border-color: var(--ion-color-warning);
            background: var(--ion-color-warning-shade);
          }
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        
        .stat-label {
          font-size: 12px;
          opacity: 0.7;
        }
      }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      
      p {
        margin-top: 16px;
        color: var(--ion-color-medium);
      }
    }

    .checklist-item-content {
      width: 100%;
      padding: 8px 0;
      
      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        
        h3 {
          margin: 0;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
      
      .item-details {
        margin: 4px 0;
        font-size: 14px;
        color: var(--ion-color-step-600);
      }
      
      .item-description {
        margin: 4px 0;
        font-size: 13px;
        color: var(--ion-color-medium);
        font-style: italic;
      }
      
      .item-checked-info {
        margin: 8px 0 0 0;
        font-size: 12px;
        color: var(--ion-color-success);
        display: flex;
        align-items: center;
        gap: 4px;
        
        ion-icon {
          font-size: 14px;
        }
      }
      
      .item-matched {
        margin: 4px 0 0 0;
        font-size: 12px;
        color: var(--ion-color-primary);
        display: flex;
        align-items: center;
        gap: 4px;
        
        ion-icon {
          font-size: 14px;
        }
      }
    }

    ion-item.checked {
      --background: var(--ion-color-success-tint);
      opacity: 0.7;
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
        margin-bottom: 20px;
      }
    }
  `]
})
export class ChecklistViewComponent implements OnInit, ViewWillEnter, ViewDidLeave {
  private workOrderService = inject(WorkOrderService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private navCtrl = inject(NavController);
  private userFeaturesService = inject(UserFeaturesService);

  isLoading = signal(false);
  showAll = signal(false);
  filterStatus = signal<'all' | 'checked' | 'unchecked'>('all');
  
  // Use service signal directly instead of local copy
  items = this.workOrderService.checklistItems;
  
  // Computed: Kann User alle Items sehen?
  canViewAllItems = computed(() => 
    this.userFeaturesService.features()?.can_toggle_all_checklist_items === true
  );
  
  // Computed: Kann User Hakliste bearbeiten?
  canManageChecklist = computed(() => 
    this.userFeaturesService.features()?.can_manage_checklist_assignments === true
  );
  
  // Computed: Gefilterte Items basierend auf filterStatus
  filteredItems = computed(() => {
    const allItems = this.items();
    const status = this.filterStatus();
    
    if (status === 'checked') {
      return allItems.filter(item => item.checked_this_month);
    } else if (status === 'unchecked') {
      return allItems.filter(item => !item.checked_this_month);
    }
    return allItems;
  });

  get totalItems() {
    return this.items().length;
  }
  
  get checkedItems() {
    return this.items().filter(item => item.checked_this_month).length;
  }
  
  get uncheckedItems() {
    return this.items().filter(item => !item.checked_this_month).length;
  }

  get currentMonth() {
    const now = new Date();
    return now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  constructor() {
    addIcons({ 
      'add-outline': addOutline, 
      'refresh-outline': refreshOutline, 
      'checkmark-circle': checkmarkCircle,
      'settings-outline': settingsOutline,
      'sync-outline': syncOutline,
      'eye': eye,
      'eye-off': eyeOff,
      'link': link,
    });
  }
  
  toggleShowAll() {
    this.showAll.update(val => !val);
    this.loadChecklist();
  }
  
  setFilter(status: 'all' | 'checked' | 'unchecked') {
    this.filterStatus.set(status);
  }

  ngOnInit() {
    // Load data once if not already loaded
    if (this.items().length === 0) {
      this.loadChecklist();
    }
  }

  ionViewWillEnter() {
    // Refresh only if data is stale or empty
    if (this.items().length === 0) {
      this.loadChecklist();
    }
  }

  ionViewDidLeave() {
    // Keep data in service - don't clear
  }

  async loadChecklist() {
    this.isLoading.set(true);
    try {
      const showAllParam = this.canViewAllItems() ? this.showAll() : undefined;
      await firstValueFrom(this.workOrderService.loadChecklistItems(true, showAllParam));
      // Data is now in service.checklistItems signal
    } catch (error) {
      console.error('Error loading checklist:', error);
      const toast = await this.toastCtrl.create({
        message: 'Fehler beim Laden der Hakliste',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshChecklist() {
    await this.loadChecklist();
    const toast = await this.toastCtrl.create({
      message: 'Hakliste aktualisiert',
      duration: 2000,
      color: 'success'
    });
    await toast.present();
  }

  navigateToMasterData() {
    // Use NavController for proper Ionic navigation from tabs
    this.navCtrl.navigateForward(['/apps/workorders/checklist'], {
      animated: true
    });
  }

  async syncWithMasterData() {
    const alert = await this.alertCtrl.create({
      header: 'Hakliste synchronisieren',
      message: 'Möchten Sie die Hakliste mit den Stammdaten abgleichen? Neue gültige Einträge werden hinzugefügt und automatisch mit vorhandenen Arbeitsscheinen abgeglichen.',
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Synchronisieren',
          handler: async () => {
            try {
              await firstValueFrom(this.workOrderService.syncChecklistItems());
              const toast = await this.toastCtrl.create({
                message: 'Synchronisation gestartet. Die Hakliste wird aktualisiert und automatisch abgeglichen...',
                duration: 3000,
                color: 'success'
              });
              await toast.present();
              
              // Aktualisiere Liste nach kurzer Verzögerung
              setTimeout(() => {
                this.refreshChecklist();
              }, 2000);
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: 'Fehler bei der Synchronisation',
                duration: 3000,
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async fillFromMasterData() {
    const alert = await this.alertCtrl.create({
      header: 'Hakliste füllen',
      message: 'Möchten Sie die Hakliste für den aktuellen Monat aus den Stammdaten füllen? Bestehende Einträge bleiben erhalten.',
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Füllen',
          handler: async () => {
            this.isLoading.set(true);
            try {
              // TODO: API-Call implementieren
              // await this.workOrderService.fillChecklistFromMasterData().toPromise();
              
              await this.loadChecklist();
              
              const toast = await this.toastCtrl.create({
                message: 'Hakliste erfolgreich aus Stammdaten gefüllt',
                duration: 3000,
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Error filling checklist:', error);
              const toast = await this.toastCtrl.create({
                message: 'Fehler beim Füllen der Hakliste',
                duration: 3000,
                color: 'danger'
              });
              await toast.present();
            } finally {
              this.isLoading.set(false);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }
}
