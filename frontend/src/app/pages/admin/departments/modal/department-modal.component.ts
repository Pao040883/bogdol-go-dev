import { Component, OnInit, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { closeOutline, saveOutline } from 'ionicons/icons';

import { IntranetApiService } from '../../../../services/intranet-api.service';
import { Department, Company } from '../../../../models/intranet.models';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-department-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonSpinner,
  ],
  templateUrl: './department-modal.component.html',
  styleUrls: ['./department-modal.component.scss'],
})
export class DepartmentModalComponent implements OnInit {
  @Input() department?: Department;
  @Input() departments: Department[] = [];

  private apiService = inject(IntranetApiService);
  private toastService = inject(ToastService);
  private modalCtrl = inject(ModalController);
  private destroy$ = new Subject<void>();

  formData = {
    name: '',
    code: '',
    description: '',
    search_keywords: '',
    company: null as number | null,
    parent: null as number | null,
    org_type: 'other' as 'administration' | 'operations' | 'other',
    is_staff_department: false,
    is_active: true,
  };

  companies: Company[] = [];
  users: any[] = [];
  isLoading = false;
  isSaving = false;

  constructor() {
    addIcons({
      closeOutline,
      saveOutline,
    });
  }

  ngOnInit() {
    this.loadCompanies();
    this.loadUsers();
    
    if (this.department) {
      this.formData = {
        name: this.department.name,
        code: this.department.code,
        description: this.department.description || '',
        search_keywords: (this.department as any).search_keywords || '',
        company: this.department.company || null,
        parent: this.department.parent || null,
        org_type: (this.department as any).org_type || 'other',
        is_staff_department: (this.department as any).is_staff_department || false,
        is_active: this.department.is_active,
      };
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCompanies() {
    this.apiService.getCompanies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.companies = response.results;
        },
        error: (err) => {
          console.error('Error loading companies:', err);
        }
      });
  }

  loadUsers() {
    this.isLoading = true;
    this.apiService.getProfiles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.results.map(profile => ({
            id: profile.id,
            name: profile.display_name || `${profile.first_name} ${profile.last_name}`,
          }));
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.isLoading = false;
        }
      });
  }

  async save() {
    if (!this.formData.name || !this.formData.code) {
      this.toastService.error('Bitte Name und Code ausfüllen');
      return;
    }

    this.isSaving = true;

    const observable = this.department
      ? this.apiService.updateDepartment(this.department.id, this.formData)
      : this.apiService.createDepartment(this.formData);

    observable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.modalCtrl.dismiss(null, this.department ? 'updated' : 'created');
        },
        error: (err) => {
          console.error('Error saving department:', err);
          this.toastService.error('Fehler beim Speichern');
          this.isSaving = false;
        }
      });
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }

  get availableParentDepartments(): Department[] {
    if (!this.department) {
      return this.departments;
    }
    // Exclude self and children to prevent circular references
    return this.departments.filter(d => d.id !== this.department!.id);
  }
}
