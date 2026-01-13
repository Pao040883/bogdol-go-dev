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
  addOutline,
  briefcaseOutline,
  createOutline,
  trashOutline,
  businessOutline,
  peopleOutline,
} from 'ionicons/icons';

import { IntranetApiService } from '../../../services/intranet-api.service';
import { Company } from '../../../models/intranet.models';
import { ToastService } from '../../../core/services/toast.service';
import { CompanyModalComponent } from './modal/company-modal.component';

@Component({
  selector: 'app-companies',
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
  templateUrl: './companies.page.html',
  styleUrls: ['./companies.page.scss'],
})
export class CompaniesPage implements OnInit, OnDestroy {
  private apiService = inject(IntranetApiService);
  private toastService = inject(ToastService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();

  companies: Company[] = [];
  filteredCompanies: Company[] = [];
  isLoading = false;
  searchTerm = '';

  constructor() {
    addIcons({
      addOutline,
      briefcaseOutline,
      createOutline,
      trashOutline,
      businessOutline,
      peopleOutline,
    });
  }

  ngOnInit() {
    this.loadCompanies();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCompanies() {
    this.isLoading = true;
    this.apiService.getCompanies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.companies = response.results;
          this.filteredCompanies = this.companies;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading companies:', err);
          this.toastService.error('Fehler beim Laden der Gesellschaften');
          this.isLoading = false;
        }
      });
  }

  onSearchChange(event: any) {
    const term = event.detail.value?.toLowerCase() || '';
    this.searchTerm = term;
    
    if (!term) {
      this.filteredCompanies = this.companies;
      return;
    }
    
    this.filteredCompanies = this.companies.filter(company =>
      company.name.toLowerCase().includes(term) ||
      company.code.toLowerCase().includes(term) ||
      company.description?.toLowerCase().includes(term)
    );
  }

  async openCreateModal() {
    const modal = await this.modalCtrl.create({
      component: CompanyModalComponent,
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'created') {
      this.toastService.success('Gesellschaft erfolgreich erstellt');
      this.loadCompanies();
    }
  }

  async openEditModal(company: Company) {
    const modal = await this.modalCtrl.create({
      component: CompanyModalComponent,
      componentProps: {
        company,
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'updated') {
      this.toastService.success('Gesellschaft erfolgreich aktualisiert');
      this.loadCompanies();
    }
  }

  async deleteCompany(company: Company) {
    const alert = await this.alertCtrl.create({
      header: 'Gesellschaft löschen?',
      message: `Möchten Sie die Gesellschaft "${company.name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel',
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.apiService.deleteCompany(company.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.toastService.success('Gesellschaft gelöscht');
                  this.loadCompanies();
                },
                error: (err) => {
                  console.error('Error deleting company:', err);
                  this.toastService.error('Fehler beim Löschen der Gesellschaft');
                }
              });
          },
        },
      ],
    });

    await alert.present();
  }
}
