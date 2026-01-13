import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, folderOpenOutline, schoolOutline, pencilOutline, trashOutline, searchOutline, bookmark, peopleOutline } from 'ionicons/icons';
import { OrganizationService } from '../../../core/services/organization.service';
import { Specialty, DepartmentMemberDetail } from '../../../models/organization.model';
import { Department } from '../../../models/department.model';
import { SpecialtyModalComponent } from './modal/specialty-modal.component';
import { FilterByDepartmentPipe } from '../../../shared/pipes/filter-by-department.pipe';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-specialties',
  templateUrl: './specialties.page.html',
  styleUrls: ['./specialties.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, FilterByDepartmentPipe]
})
export class SpecialtiesPage implements OnInit {
  specialties = signal<Specialty[]>([]);
  filteredSpecialties = signal<Specialty[]>([]);
  departments = signal<Department[]>([]);
  
  selectedDepartment = signal<number | null>(null);
  searchTerm = signal<string>('');
  isLoading = signal<boolean>(false);

  constructor(
    private organizationService: OrganizationService,
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
    private http: HttpClient
  ) {
    addIcons({ add, folderOpenOutline, schoolOutline, pencilOutline, trashOutline, searchOutline, bookmark, peopleOutline });
  }

  ngOnInit() {
    this.loadDepartments();
    this.loadSpecialties();
  }

  loadDepartments() {
    this.http.get<any>(`${environment.apiUrl}/departments/`).subscribe({
      next: (response) => {
        // Handle both array and paginated response formats
        const data = Array.isArray(response) ? response : (response.results || []);
        this.departments.set(data.filter((d: any) => d.is_active));
      },
      error: (error) => {
        console.error('Error loading departments:', error);
      }
    });
  }

  loadSpecialties() {
    this.isLoading.set(true);
    const departmentId = this.selectedDepartment();
    const search = this.searchTerm();

    this.organizationService.getSpecialties(
      departmentId || undefined,
      search || undefined
    ).subscribe({
      next: (data) => {
        this.specialties.set(data);
        this.filteredSpecialties.set(data);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading specialties:', error);
        this.showToast('Fehler beim Laden der Fachbereiche', 'danger');
        this.isLoading.set(false);
      }
    });
  }

  onDepartmentChange() {
    this.loadSpecialties();
  }

  onSearchChange() {
    this.loadSpecialties();
  }

  async openCreateModal() {
    const modal = await this.modalController.create({
      component: SpecialtyModalComponent,
      componentProps: {
        mode: 'create'
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.reload) {
        this.loadSpecialties();
      }
    });

    return await modal.present();
  }

  async openEditModal(specialty: Specialty) {
    const modal = await this.modalController.create({
      component: SpecialtyModalComponent,
      componentProps: {
        mode: 'edit',
        specialty: { ...specialty }
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.reload) {
        this.loadSpecialties();
      }
    });

    return await modal.present();
  }

  async deleteSpecialty(specialty: Specialty) {
    const alert = await this.alertController.create({
      header: 'Fachbereich löschen',
      message: `Möchten Sie den Fachbereich "${specialty.name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.performDelete(specialty.id);
          }
        }
      ]
    });

    await alert.present();
  }

  performDelete(id: number) {
    this.organizationService.deleteSpecialty(id).subscribe({
      next: () => {
        this.showToast('Fachbereich erfolgreich gelöscht', 'success');
        this.loadSpecialties();
      },
      error: (error) => {
        console.error('Error deleting specialty:', error);
        this.showToast('Fehler beim Löschen des Fachbereichs', 'danger');
      }
    });
  }

  async viewMembers(specialty: Specialty) {
    // TODO: Navigate to members view or show modal with members
    this.organizationService.getMembersWithSpecialty(specialty.id).subscribe({
      next: (members) => {
        this.showMembersAlert(specialty, members);
      },
      error: (error) => {
        console.error('Error loading members:', error);
        this.showToast('Fehler beim Laden der Mitarbeiter', 'danger');
      }
    });
  }

  async showMembersAlert(specialty: Specialty, members: DepartmentMemberDetail[]) {
    const membersList = members.length > 0
      ? members.map(m => `${m.user_data?.first_name} ${m.user_data?.last_name} (${m.department_name})`).join('\n')
      : 'Keine Mitarbeiter zugeordnet';

    const alert = await this.alertController.create({
      header: `Mitarbeiter: ${specialty.name}`,
      message: membersList,
      buttons: ['OK']
    });

    await alert.present();
  }

  getSpecialtyHierarchy(specialty: Specialty): string {
    return specialty.full_path || specialty.name;
  }

  async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
