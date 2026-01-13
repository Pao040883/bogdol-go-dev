import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonList, IonItem, IonLabel, IonBadge, IonSearchbar, IonRefresher,
  IonRefresherContent, IonFab, IonFabButton, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, documentText, create, trash, copy, calendar, location } from 'ionicons/icons';
import { WorkOrderService } from '../../../../core/services/workorder.service';
import { WorkOrderTemplate } from '../../../../core/interfaces/workorder.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-work-ticket-templates',
  templateUrl: './work-ticket-templates.page.html',
  styleUrls: ['./work-ticket-templates.page.scss'],
  standalone: true,
  imports: [
    IonFabButton, IonFab, IonRefresherContent, IonRefresher, IonSearchbar,
    IonLabel, IonItem, IonList, IonCardContent, IonCardTitle,
    IonCardHeader, IonCard, IonIcon, IonButton, IonMenuButton, IonButtons,
    IonContent, IonHeader, IonTitle, IonToolbar, CommonModule
  ],
})
export class WorkTicketTemplatesPage implements OnInit, OnDestroy {
  private workOrderService = inject(WorkOrderService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();

  templates: WorkOrderTemplate[] = [];
  searchTerm = '';
  isLoading = false;

  get filteredTemplates(): WorkOrderTemplate[] {
    if (!this.searchTerm) return this.templates;
    const search = this.searchTerm.toLowerCase();
    return this.templates.filter(t =>
      t.name.toLowerCase().includes(search) ||
      t.client_name?.toLowerCase().includes(search) ||
      t.work_type.toLowerCase().includes(search)
    );
  }

  constructor() {
    addIcons({add,documentText,calendar,trash,create,location,copy});
  }

  ngOnInit() {
    this.loadTemplates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTemplates() {
    this.isLoading = true;
    this.workOrderService.loadTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }

  doRefresh(event: any) {
    this.workOrderService.loadTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          event.target.complete();
        },
        error: () => {
          event.target.complete();
        }
      });
  }

  onSearchChanged(event: any) {
    this.searchTerm = event.target.value || '';
  }

  createTemplate() {
    this.router.navigate(['/apps/work-tickets/templates/create']);
  }

  editTemplate(template: WorkOrderTemplate) {
    this.router.navigate(['/apps/work-tickets/templates', template.id]);
  }

  async createWorkOrderFromTemplate(template: WorkOrderTemplate) {
    const alert = await this.alertCtrl.create({
      header: 'Arbeitsschein erstellen',
      message: `Arbeitsschein aus Vorlage "${template.name}" erstellen?`,
      inputs: [
        {
          name: 'start_date',
          type: 'date',
          label: 'Startdatum',
          value: new Date().toISOString().split('T')[0]
        },
        {
          name: 'end_date',
          type: 'date',
          label: 'Enddatum',
          value: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          name: 'project_number',
          type: 'text',
          placeholder: 'Projektnummer (optional)'
        }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Erstellen',
          handler: (data) => {
            if (!template.id) {
              this.showError('Template ID fehlt');
              return;
            }
            this.workOrderService.createFromTemplate({
              template_id: template.id,
              start_date: data.start_date,
              end_date: data.end_date,
              project_number: data.project_number || ''
            }).pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (order) => {
                  this.showSuccess('Arbeitsschein erfolgreich erstellt');
                  this.router.navigate(['/apps/work-tickets', order.id]);
                },
                error: () => this.showError('Fehler beim Erstellen')
              });
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteTemplate(template: WorkOrderTemplate, event: Event) {
    event.stopPropagation();
    
    if (!template.id) {
      this.showError('Template ID fehlt');
      return;
    }
    
    const alert = await this.alertCtrl.create({
      header: 'Vorlage löschen',
      message: `Möchtest du die Vorlage "${template.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.workOrderService.deleteTemplate(template.id!)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.templates = this.templates.filter(t => t.id !== template.id);
                  this.showSuccess('Vorlage gelöscht');
                },
                error: () => this.showError('Fehler beim Löschen')
              });
          }
        }
      ]
    });
    await alert.present();
  }

  private async showSuccess(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Erfolg',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showError(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Fehler',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
