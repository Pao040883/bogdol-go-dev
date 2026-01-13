import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonIcon, IonList, IonItem, IonLabel, IonInput, IonTextarea,
  IonSelect, IonSelectOption, AlertController, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { save, trash } from 'ionicons/icons';
import { WorkOrderService } from '../../../../core/services/workorder.service';
import { WorkOrderTemplate, WorkOrderClient, WorkObject } from '../../../../core/interfaces/workorder.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-work-ticket-template-form',
  templateUrl: './work-ticket-template-form.page.html',
  styleUrls: ['./work-ticket-template-form.page.scss'],
  standalone: true,
  imports: [
    IonNote, IonTextarea, IonInput, IonLabel, IonItem, IonList, IonSelectOption,
    IonSelect, IonIcon, IonButton, IonBackButton, IonButtons, IonContent,
    IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule
  ],
})
export class WorkTicketTemplateFormPage implements OnInit, OnDestroy {
  private workOrderService = inject(WorkOrderService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();

  templateId?: number;
  template: Partial<WorkOrderTemplate> = {
    name: '',
    work_type: '',
    work_days: 1,
    description: '',
    client: undefined,
    work_object: undefined
  };

  clients: WorkOrderClient[] = [];
  workObjects: WorkObject[] = [];
  isLoading = false;

  get isEditMode(): boolean {
    return !!this.templateId;
  }

  constructor() {
    addIcons({ save, trash });
  }

  ngOnInit() {
    this.loadClients();
    
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== 'create') {
        this.templateId = parseInt(id, 10);
        this.loadTemplate();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTemplate() {
    if (!this.templateId) return;

    this.isLoading = true;
    this.workOrderService.loadTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          const found = templates.find(t => t.id === this.templateId);
          if (found) {
            this.template = { ...found };
            if (found.client) {
              this.onClientChange();
            }
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.showError('Fehler beim Laden der Vorlage');
        }
      });
  }

  loadClients() {
    this.workOrderService.loadClients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (clients) => {
          this.clients = clients;
        }
      });
  }

  onClientChange() {
    if (!this.template.client) {
      this.workObjects = [];
      this.template.work_object = undefined;
      return;
    }

    this.workOrderService.loadObjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (objects) => {
          this.workObjects = objects.filter(obj => obj.client === this.template.client);
        }
      });
  }

  async saveTemplate() {
    if (!this.template.name || !this.template.work_type) {
      await this.showError('Bitte Name und Arbeitstyp ausfüllen');
      return;
    }

    const templateData = {
      ...this.template,
      work_days: Number(this.template.work_days) || 1
    };

    const operation = this.isEditMode
      ? this.workOrderService.updateTemplate(this.templateId!, templateData)
      : this.workOrderService.createTemplate(templateData);

    operation.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess(this.isEditMode ? 'Vorlage aktualisiert' : 'Vorlage erstellt');
          this.router.navigate(['/apps/work-tickets/templates']);
        },
        error: () => {
          this.showError(this.isEditMode ? 'Fehler beim Aktualisieren' : 'Fehler beim Erstellen');
        }
      });
  }

  async deleteTemplate() {
    if (!this.templateId) return;

    const alert = await this.alertCtrl.create({
      header: 'Vorlage löschen',
      message: 'Möchtest du diese Vorlage wirklich löschen?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.workOrderService.deleteTemplate(this.templateId!)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.showSuccess('Vorlage gelöscht');
                  this.router.navigate(['/apps/work-tickets/templates']);
                },
                error: () => this.showError('Fehler beim Löschen')
              });
          }
        }
      ]
    });
    await alert.present();
  }

  async createNewClient() {
    const alert = await this.alertCtrl.create({
      header: 'Neuen Kunden anlegen',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Name' },
        { name: 'address', type: 'text', placeholder: 'Adresse' },
        { name: 'contact_person', type: 'text', placeholder: 'Ansprechpartner' },
        { name: 'phone', type: 'text', placeholder: 'Telefon' },
        { name: 'email', type: 'email', placeholder: 'E-Mail' }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Speichern',
          handler: (data) => {
            if (!data.name) {
              this.showError('Name ist erforderlich');
              return false;
            }
            this.workOrderService.createClient(data)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (client) => {
                  this.clients = [...this.clients, client];
                  this.template.client = client.id;
                  this.showSuccess('Kunde erstellt');
                },
                error: () => this.showError('Fehler beim Erstellen')
              });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async createNewObject() {
    if (!this.template.client) {
      await this.showError('Bitte zuerst einen Kunden auswählen');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Neues Objekt anlegen',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Name/Bezeichnung' },
        { name: 'address', type: 'text', placeholder: 'Adresse' },
        { name: 'description', type: 'textarea', placeholder: 'Beschreibung' }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Speichern',
          handler: (data) => {
            if (!data.name) {
              this.showError('Name ist erforderlich');
              return false;
            }
            this.workOrderService.createObject({ ...data, client: this.template.client })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (obj) => {
                  this.workObjects = [...this.workObjects, obj];
                  this.template.work_object = obj.id;
                  this.showSuccess('Objekt erstellt');
                },
                error: () => this.showError('Fehler beim Erstellen')
              });
            return true;
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
