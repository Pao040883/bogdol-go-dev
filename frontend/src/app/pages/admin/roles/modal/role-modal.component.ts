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
import { DepartmentRole } from '../../../../models/intranet.models';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-role-modal',
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
  templateUrl: './role-modal.component.html',
  styleUrls: ['./role-modal.component.scss'],
})
export class RoleModalComponent implements OnInit {
  @Input() role?: DepartmentRole;

  private apiService = inject(IntranetApiService);
  private toastService = inject(ToastService);
  private modalCtrl = inject(ModalController);
  private destroy$ = new Subject<void>();

  formData = {
    name: '',
    code: '',
    description: '',
    search_keywords: '',
    hierarchy_level: 1,
    org_type: 'administration' as 'administration' | 'operations' | 'both',
    color: '#3880ff',
    is_active: true,
    can_receive_faktura_assignments: false,
  };

  hierarchyLevels = [
    { value: 1, label: 'Level 1 - Geschäftsführung' },
    { value: 2, label: 'Level 2 - Leitung' },
    { value: 3, label: 'Level 3 - Mitarbeiter' },
    { value: 4, label: 'Level 4 - Assistenz' },
  ];

  orgTypes = [
    { value: 'administration', label: 'Verwaltung' },
    { value: 'operations', label: 'Einsatzdienst' },
    { value: 'both', label: 'Beide' },
  ];

  isSaving = false;

  constructor() {
    addIcons({
      closeOutline,
      saveOutline,
    });
  }

  ngOnInit() {
    if (this.role) {
      this.formData = {
        name: this.role.name,
        code: this.role.code,
        description: this.role.description || '',
        search_keywords: (this.role as any).search_keywords || '',
        hierarchy_level: this.role.hierarchy_level,
        org_type: this.role.org_type,
        color: this.role.color || '#3880ff',
        is_active: this.role.is_active,
        can_receive_faktura_assignments: this.role.can_receive_faktura_assignments || false,
      };
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async save() {
    if (!this.formData.name || !this.formData.code) {
      this.toastService.error('Bitte Name und Code ausfüllen');
      return;
    }

    this.isSaving = true;

    const observable = this.role
      ? this.apiService.updateDepartmentRole(this.role.id, this.formData)
      : this.apiService.createDepartmentRole(this.formData);

    observable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.modalCtrl.dismiss(null, this.role ? 'updated' : 'created');
        },
        error: (err) => {
          console.error('Error saving role:', err);
          this.toastService.error('Fehler beim Speichern');
          this.isSaving = false;
        }
      });
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }
}
