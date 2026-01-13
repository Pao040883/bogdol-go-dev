import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ViewWillEnter, ViewDidLeave, NavController } from '@ionic/angular';
import { WorkOrderService } from '../../../../core/services/workorder.service';
import { RecurringWorkOrderChecklist } from '../../../../core/interfaces/workorder.types';
import { ChecklistEditModalComponent } from './checklist-edit-modal/checklist-edit-modal.component';
import { ChecklistImportModalComponent } from './checklist-import-modal/checklist-import-modal.component';
import { UserFeaturesService } from '../../../../services/user-features.service';
import { addIcons } from 'ionicons';
import { 
  add, 
  refresh, 
  create, 
  trash, 
  checkboxOutline, 
  calendarOutline,
  cloudUpload,
  arrowBack,
  eye,
  eyeOff
} from 'ionicons/icons';

@Component({
  selector: 'app-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './checklist.page.html',
  styleUrls: ['./checklist.page.scss']
})
export class ChecklistPage implements OnInit, ViewWillEnter, ViewDidLeave {
  protected workorderService = inject(WorkOrderService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private navCtrl = inject(NavController);
  protected userFeaturesService = inject(UserFeaturesService);

  searchTerm = signal('');
  filterMode = signal<'active' | 'sr' | 'inactive'>('active');
  showAll = signal(false);
  isInitialized = signal(false);
  
  // Computed: Kann User alle Items sehen?
  canViewAllItems = computed(() => 
    this.userFeaturesService.features()?.can_toggle_all_checklist_items === true
  );
  
  // Computed: Kann User Hakliste bearbeiten?
  canManageChecklist = computed(() => {
    const features = this.userFeaturesService.features();
    return features?.can_manage_checklist_assignments === true;
  });
  
  // Computed: Ist User Admin/Staff für Import?
  isAdminUser = computed(() => {
    // Später könnte man hier ein is_staff/is_superuser Flag aus features nutzen
    // Für jetzt: Nur wenn can_view_admin=true
    return this.userFeaturesService.features()?.can_view_admin === true;
  });

  constructor() {
    addIcons({
      'add': add,
      'refresh': refresh,
      'create': create,
      'trash': trash,
      'checkbox-outline': checkboxOutline,
      'calendar-outline': calendarOutline,
      'cloud-upload': cloudUpload,
      'arrow-back': arrowBack,
      'eye': eye,
      'eye-off': eyeOff
    });
  }

  // Einfache Getter ohne computed - zum Testen
  get allItems() {
    return this.workorderService.checklistItems() || [];
  }
  
  get filteredItems() {
    try {
      let items = this.allItems;
      
      // Filter by mode first (active/inactive)
      const mode = this.filterMode();
      if (mode === 'active') {
        items = items.filter(item => item.is_active !== false);
      } else if (mode === 'inactive') {
        items = items.filter(item => item.is_active === false);
      } else if (mode === 'sr') {
        items = items.filter(item => !!item.sr_invoice_number);
      }
      
      // Filter by search term
      const search = this.searchTerm();
      if (search) {
        const searchLower = search.toLowerCase();
        items = items.filter(item => 
          item.object_number?.toLowerCase().includes(searchLower) ||
          item.project_number?.toLowerCase().includes(searchLower) ||
          item.object_description?.toLowerCase().includes(searchLower)
        );
      }
      
      return items;
    } catch (error) {
      console.error('Error in filteredItems getter:', error);
      return [];
    }
  }

  get allCount() {
    return this.allItems.length;
  }
  
  get emptyStateMessage() {
    const search = this.searchTerm();
    return (search && search.length > 0)
      ? 'Keine Treffer für Ihre Suche' 
      : 'Noch keine Haklisten-Einträge vorhanden';
  }

  ngOnInit() {
    // Initialisierung erfolgt in ionViewWillEnter
  }

  goBack() {
    this.navCtrl.back();
  }

  ionViewWillEnter() {
    // Remove any lingering focus to prevent aria-hidden errors
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.tagName !== 'BODY') {
      activeElement.blur();
    }
    
    // Verzögere Initialisierung um sicherzustellen dass View bereit ist
    setTimeout(() => {
      this.isInitialized.set(true);
      this.loadData();
    }, 100);
  }

  ionViewDidLeave() {
    // Cleanup beim Verlassen der View
    this.isInitialized.set(false);
    
    // Remove focus from any element
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.tagName !== 'BODY') {
      activeElement.blur();
    }
  }

  loadData() {
    // Beim SR-Modus alle Items laden (isActive=undefined)
    // Bei active/inactive Modi entsprechend filtern
    const mode = this.filterMode();
    let isActive: boolean | undefined;
    
    if (mode === 'sr') {
      isActive = undefined; // Alle Items laden für SR-Filter
    } else if (mode === 'active') {
      isActive = true;
    } else if (mode === 'inactive') {
      isActive = false;
    }
    
    // Scope-basierte Filterung erfolgt automatisch im Backend
    // showAll nur senden wenn canViewAllItems=true
    const showAllParam = this.canViewAllItems() ? this.showAll() : undefined;
    this.workorderService.loadChecklistItems(isActive, showAllParam).subscribe();
  }

  refresh() {
    this.loadData();
  }
  
  toggleShowAll() {
    this.showAll.update(val => !val);
    this.loadData();
  }

  onFilterModeChange(mode: 'active' | 'sr' | 'inactive'): void {
    this.filterMode.set(mode);
    this.loadData();
  }

  async addItem() {
    const modal = await this.modalCtrl.create({
      component: ChecklistEditModalComponent,
      componentProps: {
        mode: 'create'
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      setTimeout(() => this.refresh(), 100);
    }
  }
  async openImportModal() {
    const modal = await this.modalCtrl.create({
      component: ChecklistImportModalComponent,
      cssClass: 'import-modal'
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.refresh) {
      this.refresh();
    }
  }
  async editItem(item: RecurringWorkOrderChecklist) {
    const modal = await this.modalCtrl.create({
      component: ChecklistEditModalComponent,
      componentProps: {
        mode: 'edit',
        item: item
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      setTimeout(() => this.refresh(), 100);
    }
  }

  async deleteItem(item: RecurringWorkOrderChecklist) {
    if (!item.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Eintrag löschen',
      message: `Möchten Sie den Eintrag "${item.object_number} - ${item.project_number}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.workorderService.deleteChecklistItem(item.id!).subscribe({
              next: () => {
                console.log('Checklist item deleted');
              },
              error: (err) => {
                console.error('Delete error:', err);
                this.showError('Fehler beim Löschen');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }

  async showError(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Fehler',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
