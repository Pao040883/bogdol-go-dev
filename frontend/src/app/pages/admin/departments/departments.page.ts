import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSearchbar,
  IonSpinner,
  ModalController,
  AlertController,
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  addOutline,
  businessOutline,
  createOutline,
  trashOutline,
  peopleOutline,
} from 'ionicons/icons';

import { IntranetApiService } from '../../../services/intranet-api.service';
import { Department } from '../../../models/intranet.models';
import { ToastService } from '../../../core/services/toast.service';
import { DepartmentModalComponent } from './modal/department-modal.component';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSearchbar,
    IonSpinner,
  ],
  templateUrl: './departments.page.html',
  styleUrls: ['./departments.page.scss'],
})
export class DepartmentsPage implements OnInit {
  private apiService = inject(IntranetApiService);
  private toastService = inject(ToastService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();

  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  isLoading = false;
  searchTerm = '';

  constructor() {
    addIcons({
      addOutline,
      businessOutline,
      createOutline,
      trashOutline,
      peopleOutline,
    });
  }

  ngOnInit() {
    this.loadDepartments();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepartments() {
    this.isLoading = true;
    this.apiService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.departments = Array.isArray(response) ? response : (response.results || []);
          this.filteredDepartments = this.departments;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading departments:', err);
          this.toastService.error('Fehler beim Laden der Abteilungen');
          this.isLoading = false;
        }
      });
  }

  onSearchChange(event: any) {
    const term = event.detail.value?.toLowerCase() || '';
    this.searchTerm = term;
    
    if (!term) {
      this.filteredDepartments = this.departments;
      return;
    }
    
    this.filteredDepartments = this.departments.filter(dept =>
      dept.name.toLowerCase().includes(term) ||
      dept.code.toLowerCase().includes(term) ||
      dept.description?.toLowerCase().includes(term)
    );
  }

  async openCreateModal() {
    const modal = await this.modalCtrl.create({
      component: DepartmentModalComponent,
      componentProps: {
        departments: this.departments,
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'created') {
      this.toastService.success('Abteilung erfolgreich erstellt');
      this.loadDepartments();
    }
  }

  async openEditModal(department: Department) {
    const modal = await this.modalCtrl.create({
      component: DepartmentModalComponent,
      componentProps: {
        department,
        departments: this.departments,
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'updated') {
      this.toastService.success('Abteilung erfolgreich aktualisiert');
      this.loadDepartments();
    }
  }

  async deleteDepartment(department: Department) {
    const alert = await this.alertCtrl.create({
      header: 'Abteilung löschen?',
      message: `Möchten Sie die Abteilung "${department.name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel',
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.apiService.deleteDepartment(department.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.toastService.success('Abteilung gelöscht');
                  this.loadDepartments();
                },
                error: (err) => {
                  console.error('Error deleting department:', err);
                  this.toastService.error('Fehler beim Löschen der Abteilung');
                }
              });
          },
        },
      ],
    });

    await alert.present();
  }
}
