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
  IonToggle,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { closeOutline, saveOutline } from 'ionicons/icons';

import { IntranetApiService } from '../../../../services/intranet-api.service';
import { Company } from '../../../../models/intranet.models';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-company-modal',
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
    IonToggle,
    IonSpinner,
  ],
  templateUrl: './company-modal.component.html',
  styleUrls: ['./company-modal.component.scss'],
})
export class CompanyModalComponent implements OnInit {
  @Input() company?: Company;

  private apiService = inject(IntranetApiService);
  private toastService = inject(ToastService);
  private modalCtrl = inject(ModalController);
  private destroy$ = new Subject<void>();

  formData = {
    name: '',
    code: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    is_active: true,
  };

  isSaving = false;

  constructor() {
    addIcons({
      closeOutline,
      saveOutline,
    });
  }

  ngOnInit() {
    if (this.company) {
      this.formData = {
        name: this.company.name,
        code: this.company.code,
        description: this.company.description || '',
        address: this.company.address || '',
        phone: this.company.phone || '',
        email: this.company.email || '',
        website: this.company.website || '',
        is_active: this.company.is_active,
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

    const observable = this.company
      ? this.apiService.updateCompany(this.company.id, this.formData)
      : this.apiService.createCompany(this.formData);

    observable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.modalCtrl.dismiss(null, this.company ? 'updated' : 'created');
        },
        error: (err) => {
          console.error('Error saving company:', err);
          this.toastService.error('Fehler beim Speichern');
          this.isSaving = false;
        }
      });
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }
}
