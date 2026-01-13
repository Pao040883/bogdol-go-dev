import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { OrganizationService } from '../../../../core/services/organization.service';
import { Specialty } from '../../../../models/organization.model';
import { Department } from '../../../../models/department.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-specialty-modal',
  templateUrl: './specialty-modal.component.html',
  styleUrls: ['./specialty-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class SpecialtyModalComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() specialty?: Specialty;

  formData = signal<Partial<Specialty>>({
    name: '',
    code: '',
    description: '',
    department: undefined,
    parent: null,
    search_keywords: '',
    display_order: 0,
    is_active: true
  });

  departments = signal<Department[]>([]);
  parentSpecialties = signal<Specialty[]>([]);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  constructor(
    private modalController: ModalController,
    private organizationService: OrganizationService,
    private toastController: ToastController,
    private http: HttpClient
  ) {
    addIcons({ close: closeOutline });
  }

  ngOnInit() {
    if (this.mode === 'edit' && this.specialty) {
      this.formData.set({ ...this.specialty });
    }
    this.loadDepartments();
    this.loadParentSpecialties();
  }

  loadDepartments() {
    this.http.get<Department[]>(`${environment.apiUrl}/departments/`).subscribe({
      next: (data) => {
        this.departments.set(data);
      },
      error: (error) => {
        console.error('Error loading departments:', error);
      }
    });
  }

  loadParentSpecialties() {
    this.organizationService.getSpecialties().subscribe({
      next: (data) => {
        // Filter out current specialty and its children to prevent circular reference
        const filtered = data.filter(s => 
          this.mode === 'create' || (s.id !== this.specialty?.id && s.parent !== this.specialty?.id)
        );
        this.parentSpecialties.set(filtered);
      },
      error: (error) => {
        console.error('Error loading parent specialties:', error);
      }
    });
  }

  onDepartmentChange(departmentId: number) {
    // Filter parent specialties by selected department
    this.organizationService.getSpecialties(departmentId).subscribe({
      next: (data) => {
        const filtered = data.filter(s => 
          this.mode === 'create' || (s.id !== this.specialty?.id)
        );
        this.parentSpecialties.set(filtered);
      }
    });
  }

  async save() {
    const data = this.formData();
    
    // Validation
    if (!data.name || !data.code || !data.department) {
      await this.showToast('Bitte füllen Sie alle Pflichtfelder aus', 'warning');
      return;
    }

    this.isSaving.set(true);

    const request = this.mode === 'create'
      ? this.organizationService.createSpecialty(data)
      : this.organizationService.updateSpecialty(this.specialty!.id, data);

    request.subscribe({
      next: async () => {
        await this.showToast(
          this.mode === 'create' ? 'Fachbereich erstellt' : 'Fachbereich aktualisiert',
          'success'
        );
        this.modalController.dismiss({ reload: true });
      },
      error: async (error) => {
        console.error('Error saving specialty:', error);
        await this.showToast('Fehler beim Speichern', 'danger');
        this.isSaving.set(false);
      }
    });
  }

  cancel() {
    this.modalController.dismiss();
  }

  updateFormField(field: keyof Specialty, value: any) {
    this.formData.update(data => ({ ...data, [field]: value }));
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
