import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ToastController, AlertController } from '@ionic/angular';
import { WorkorderAssignmentService, ServiceManager, WorkorderAssignment } from './workorder-assignment.service';

@Component({
  selector: 'app-workorder-assignment-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './workorder-assignment-modal.component.html',
  styleUrls: ['./workorder-assignment-modal.component.scss']
})
export class WorkorderAssignmentModalComponent implements OnInit {
  serviceManagers = signal<ServiceManager[]>([]);
  myAssignments = signal<WorkorderAssignment[]>([]);
  loading = signal(true);
  
  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController,
    private workorderService: WorkorderAssignmentService
  ) {}
  
  async ngOnInit() {
    await this.loadData();
  }
  
  async loadData() {
    this.loading.set(true);
    try {
      const [managers, assignments] = await Promise.all([
        this.workorderService.getServiceManagers(),
        this.workorderService.getMyAssignments()
      ]);
      
      this.serviceManagers.set(managers);
      this.myAssignments.set(assignments);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      await this.showToast('Fehler beim Laden der Daten', 'danger');
    } finally {
      this.loading.set(false);
    }
  }
  
  isAssigned(managerId: number): boolean {
    return this.myAssignments().some(a => a.submitter.id === managerId);
  }
  
  getAssignment(managerId: number): WorkorderAssignment | undefined {
    return this.myAssignments().find(a => a.submitter.id === managerId);
  }
  
  async toggleAssignment(manager: ServiceManager, event: any) {
    const isChecked = event.detail.checked;
    
    if (isChecked) {
      await this.assignManager(manager);
    } else {
      const assignment = this.getAssignment(manager.id);
      if (assignment) {
        await this.removeAssignment(assignment);
      }
    }
  }
  
  async assignManager(manager: ServiceManager) {
    try {
      const newAssignment = await this.workorderService.createAssignment({
        submitter_id: manager.id,
        specialty_id: manager.specialty?.id
      });
      
      this.myAssignments.update(assignments => [...assignments, newAssignment]);
      await this.showToast(`${manager.name} wurde zugewiesen`, 'success');
    } catch (error) {
      console.error('Fehler beim Zuweisen:', error);
      await this.showToast('Fehler beim Zuweisen', 'danger');
    }
  }
  
  async removeAssignment(assignment: WorkorderAssignment) {
    const alert = await this.alertController.create({
      header: 'Zuweisung entfernen?',
      message: `Möchten Sie die Zuweisung von ${assignment.submitter.name} wirklich entfernen?`,
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
              await this.workorderService.deleteAssignment(assignment.id);
              this.myAssignments.update(assignments => 
                assignments.filter(a => a.id !== assignment.id)
              );
              await this.showToast('Zuweisung wurde entfernt', 'success');
            } catch (error) {
              console.error('Fehler beim Entfernen:', error);
              await this.showToast('Fehler beim Entfernen', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
  
  dismiss() {
    this.modalController.dismiss();
  }
  
  getAssignmentCount(): number {
    return this.myAssignments().length;
  }
}
