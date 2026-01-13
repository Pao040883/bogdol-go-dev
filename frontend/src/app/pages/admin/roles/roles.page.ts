import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
  peopleOutline,
  refreshOutline,
  addOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';

import { IntranetApiService } from '../../../services/intranet-api.service';
import { DepartmentRole } from '../../../models/intranet.models';
import { ToastService } from '../../../core/services/toast.service';
import { RoleModalComponent } from './modal/role-modal.component';

@Component({
  selector: 'app-roles',
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
  templateUrl: './roles.page.html',
  styleUrls: ['./roles.page.scss'],
})
export class RolesPage implements OnInit, OnDestroy {
  private apiService = inject(IntranetApiService);
  private toastService = inject(ToastService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();

  roles: DepartmentRole[] = [];
  isLoading = false;
  searchTerm = '';

  constructor() {
    addIcons({
      peopleOutline,
      refreshOutline,
      addOutline,
      createOutline,
      trashOutline,
    });
  }

  ngOnInit() {
    this.loadRoles();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRoles() {
    this.isLoading = true;
    this.apiService.getDepartmentRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading roles:', err);
          this.toastService.error('Fehler beim Laden der Rollen');
          this.isLoading = false;
        }
      });
  }

  onSearchChange(event: any) {
    const term = event.detail.value?.toLowerCase() || '';
    this.searchTerm = term;
  }

  get filteredRoles(): DepartmentRole[] {
    if (!this.searchTerm) {
      return this.roles;
    }
    const term = this.searchTerm.toLowerCase();
    return this.roles.filter(role => 
      role.name.toLowerCase().includes(term) ||
      role.code.toLowerCase().includes(term) ||
      (role.description && role.description.toLowerCase().includes(term))
    );
  }

  getRoleBadgeColor(level: number): string {
    const colors: Record<number, string> = {
      1: 'danger',
      2: 'warning',
      3: 'primary',
      4: 'success',
    };
    return colors[level] || 'medium';
  }

  async openCreateModal() {
    const modal = await this.modalCtrl.create({
      component: RoleModalComponent,
    });

    await modal.present();
    const { role } = await modal.onWillDismiss();

    if (role === 'created') {
      this.toastService.success('Rolle erfolgreich erstellt');
      this.loadRoles();
    }
  }

  async openEditModal(roleItem: DepartmentRole) {
    const modal = await this.modalCtrl.create({
      component: RoleModalComponent,
      componentProps: {
        role: roleItem,
      },
    });

    await modal.present();
    const { role } = await modal.onWillDismiss();

    if (role === 'updated') {
      this.toastService.success('Rolle erfolgreich aktualisiert');
      this.loadRoles();
    }
  }

  async deleteRole(role: DepartmentRole) {
    const alert = await this.alertCtrl.create({
      header: 'Rolle löschen?',
      message: `Möchten Sie die Rolle "${role.name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel',
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.apiService.deleteDepartmentRole(role.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.toastService.success('Rolle gelöscht');
                  this.loadRoles();
                },
                error: (err) => {
                  console.error('Error deleting role:', err);
                  this.toastService.error('Fehler beim Löschen der Rolle');
                }
              });
          },
        },
      ],
    });

    await alert.present();
  }
}
