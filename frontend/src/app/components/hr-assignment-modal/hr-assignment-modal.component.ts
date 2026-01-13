import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonSpinner,
  IonIcon,
  ModalController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, add, trash, person, business, calendar } from 'ionicons/icons';
import { HRAssignmentService, HRAssignment, ServiceManager } from './hr-assignment.service';

@Component({
  selector: 'app-hr-assignment-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,

    IonNote,
    IonSpinner,
    IonIcon
  ],
  templateUrl: './hr-assignment-modal.component.html',
  styleUrls: ['./hr-assignment-modal.component.scss']
})
export class HRAssignmentModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private hrService = inject(HRAssignmentService);

  serviceManagers = signal<ServiceManager[]>([]);
  myAssignments = signal<HRAssignment[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ close, add, trash, person, business, calendar });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      // Lade alle Service Manager
      const managers = await this.hrService.getServiceManagers();
      this.serviceManagers.set(managers);

      // Lade meine HR-Zuweisungen (wo ich hr_processor bin)
      const assignments = await this.hrService.getMyAssignments();
      this.myAssignments.set(assignments);
    } catch (error) {
      console.error('Failed to load data:', error);
      await this.showToast('Fehler beim Laden der Daten', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  isAssigned(managerId: number): boolean {
    return this.myAssignments().some(a => a.employee.id === managerId && a.is_active);
  }

  getAssignment(managerId: number): HRAssignment | undefined {
    return this.myAssignments().find(a => a.employee.id === managerId && a.is_active);
  }

  async toggleAssignment(manager: ServiceManager, event: any) {
    const isChecked = event.detail.checked;

    if (isChecked) {
      // Zuweisen
      await this.assignManager(manager);
    } else {
      // Entfernen
      const assignment = this.getAssignment(manager.id);
      if (assignment) {
        await this.removeAssignment(assignment);
      }
    }
  }

  async assignManager(manager: ServiceManager) {
    try {
      const newAssignment = await this.hrService.createAssignment({
        employee_id: manager.id,
        department_id: manager.department?.id,
        valid_from: null,
        valid_until: null
      });

      // Zur Liste hinzufügen
      this.myAssignments.set([...this.myAssignments(), newAssignment]);
      
      await this.showToast(`${manager.name} wurde zugewiesen`, 'success');
    } catch (error) {
      console.error('Failed to assign:', error);
      await this.showToast('Fehler beim Zuweisen', 'danger');
    }
  }

  async removeAssignment(assignment: HRAssignment) {
    const alert = await this.alertCtrl.create({
      header: 'Zuweisung entfernen',
      message: `Möchten Sie die Zuweisung von ${assignment.employee.name} wirklich entfernen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Entfernen',
          role: 'destructive',
          handler: async () => {
            try {
              await this.hrService.deleteAssignment(assignment.id);
              
              // Aus Liste entfernen
              this.myAssignments.set(
                this.myAssignments().filter(a => a.id !== assignment.id)
              );
              
              await this.showToast('Zuweisung wurde entfernt', 'success');
            } catch (error) {
              console.error('Failed to delete:', error);
              await this.showToast('Fehler beim Entfernen', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color
    });
    await toast.present();
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
