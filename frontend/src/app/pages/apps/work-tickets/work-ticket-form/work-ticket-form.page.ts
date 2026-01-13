import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonLabel, IonInput, IonTextarea, IonSelect,
  IonSelectOption, IonDatetime, IonDatetimeButton, IonModal, IonList,
  IonNote, IonSpinner, IonItemDivider, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { save, close, trash, documentText } from 'ionicons/icons';
import { WorkOrderService } from '../../../../core/services/workorder.service';
import { WorkOrder, WorkOrderClient, WorkObject, WorkOrderTemplate } from '../../../../core/interfaces/workorder.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-work-ticket-form',
  templateUrl: './work-ticket-form.page.html',
  styleUrls: ['./work-ticket-form.page.scss'],
  standalone: true,
  imports: [
    IonSpinner, IonNote, IonList, IonModal, IonDatetimeButton, IonDatetime,
    IonSelectOption, IonSelect, IonTextarea, IonInput, IonLabel, IonItem,
    IonIcon, IonButton, IonBackButton, IonButtons, IonContent, IonHeader,
    IonTitle, IonToolbar, IonItemDivider,
    CommonModule, ReactiveFormsModule
  ],
})
export class WorkTicketFormPage implements OnInit, OnDestroy {
  private workOrderService = inject(WorkOrderService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();

  workOrderForm!: FormGroup;
  clients: WorkOrderClient[] = [];
  workObjects: WorkObject[] = [];
  filteredWorkObjects: WorkObject[] = [];
  templates: WorkOrderTemplate[] = [];
  isLoading = false;
  orderId: number | null = null;

  get isEditMode(): boolean {
    return this.orderId !== null;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Arbeitsschein bearbeiten' : 'Neuer Arbeitsschein';
  }

  constructor() {
    addIcons({ save, close, trash, documentText });
    this.initForm();
  }

  ngOnInit() {
    this.loadData();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.orderId = parseInt(id);
      this.loadWorkOrder(parseInt(id));
    }

    this.workOrderForm.get('client')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(clientId => {
        this.updateFilteredObjects(clientId);
        if (clientId) {
          this.workOrderService.loadObjectsByClient(clientId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(objects => {
              this.workObjects = objects;
              this.updateFilteredObjects(clientId);
            });
        }
        this.workOrderForm.patchValue({ work_object: null }, { emitEvent: false });
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.workOrderForm = this.fb.group({
      client: [null, Validators.required],
      work_object: [null],
      project_number: [''],
      work_type: ['', Validators.required],
      work_description: [''],
      start_date: [new Date().toISOString(), Validators.required],
      end_date: [new Date().toISOString(), Validators.required],
      work_days: [1, [Validators.required, Validators.min(1)]],
      work_schedule: [''],
      customer_notes: [''],
      internal_notes: [''],
      status: ['draft']
    });
  }

  private updateFilteredObjects(clientId: number | null) {
    if (!clientId) {
      this.filteredWorkObjects = [];
      return;
    }
    this.filteredWorkObjects = this.workObjects.filter(obj => obj.client === clientId);
  }

  loadData() {
    this.isLoading = true;

    this.workOrderService.loadClients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (clients) => {
          this.clients = clients;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });

    this.workOrderService.loadObjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (objects) => {
          this.workObjects = objects;
        }
      });

    this.workOrderService.loadTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
        }
      });
  }

  loadWorkOrder(id: number) {
    this.workOrderService.getWorkOrder(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          if (order) {
            this.workOrderForm.patchValue({
              client: order.client,
              work_object: order.work_object,
              project_number: order.project_number,
              work_type: order.work_type,
              work_description: order.work_description,
              start_date: order.start_date,
              end_date: order.end_date,
              work_days: order.work_days,
              work_schedule: order.work_schedule,
              customer_notes: order.customer_notes,
              internal_notes: order.internal_notes,
              status: order.status
            });
          }
        },
        error: () => {
          this.showError('Fehler beim Laden des Arbeitsscheins');
          this.router.navigate(['/apps/work-tickets']);
        }
      });
  }

  async onSubmit() {
    if (this.workOrderForm.invalid) {
      this.markFormGroupTouched(this.workOrderForm);
      await this.showError('Bitte fülle alle Pflichtfelder aus');
      return;
    }

    const formData = {
      ...this.workOrderForm.value,
      start_date: this.formatDateForBackend(this.workOrderForm.value.start_date),
      end_date: this.formatDateForBackend(this.workOrderForm.value.end_date)
    };

    if (this.isEditMode) {
      this.workOrderService.updateWorkOrder(this.orderId!, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.router.navigate(['/apps/work-tickets']),
          error: () => this.showError('Fehler beim Aktualisieren')
        });
    } else {
      this.workOrderService.createWorkOrder(formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.router.navigate(['/apps/work-tickets']),
          error: () => this.showError('Fehler beim Erstellen')
        });
    }
  }

  private formatDateForBackend(dateValue: string): string {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async onDelete() {
    if (!this.isEditMode) return;

    const alert = await this.alertCtrl.create({
      header: 'Stornieren bestätigen',
      message: 'Möchtest du diesen Arbeitsschein wirklich stornieren?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Stornieren',
          role: 'destructive',
          handler: () => {
            this.workOrderService.cancelWorkOrder(this.orderId!)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => this.router.navigate(['/apps/work-tickets']),
                error: () => this.showError('Fehler beim Stornieren')
              });
          }
        }
      ]
    });
    await alert.present();
  }

  async openNewClientModal() {
    const alert = await this.alertCtrl.create({
      header: 'Neuer Kunde',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Kundenname *' },
        { name: 'street', type: 'text', placeholder: 'Straße' },
        { name: 'postal_code', type: 'text', placeholder: 'PLZ' },
        { name: 'city', type: 'text', placeholder: 'Stadt' },
        { name: 'phone', type: 'tel', placeholder: 'Telefon' },
        { name: 'email', type: 'email', placeholder: 'E-Mail' }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Erstellen',
          handler: (data) => {
            if (!data.name) {
              this.showError('Kundenname ist erforderlich');
              return false;
            }
            this.createClient(data);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private createClient(data: any) {
    this.workOrderService.createClient(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (client) => {
          this.clients.push(client);
          this.workOrderForm.patchValue({ client: client.id });
        },
        error: () => this.showError('Fehler beim Erstellen des Kunden')
      });
  }

  async openNewObjectModal() {
    const clientId = this.workOrderForm.get('client')?.value;
    if (!clientId) {
      await this.showError('Bitte wähle zuerst einen Kunden aus');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Neues Arbeitsobjekt',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Objektname *' },
        { name: 'street', type: 'text', placeholder: 'Straße' },
        { name: 'postal_code', type: 'text', placeholder: 'PLZ' },
        { name: 'city', type: 'text', placeholder: 'Stadt' },
        { name: 'contact_person', type: 'text', placeholder: 'Ansprechpartner' },
        { name: 'contact_phone', type: 'tel', placeholder: 'Telefon' }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Erstellen',
          handler: (data) => {
            if (!data.name) {
              this.showError('Objektname ist erforderlich');
              return false;
            }
            this.createObject({ ...data, client: clientId });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private createObject(data: any) {
    this.workOrderService.createObject(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (obj) => {
          this.workObjects.push(obj);
          this.updateFilteredObjects(data.client);
          this.workOrderForm.patchValue({ work_object: obj.id });
        },
        error: () => this.showError('Fehler beim Erstellen des Objekts')
      });
  }

  onCancel() {
    this.router.navigate(['/apps/work-tickets']);
  }

  async loadFromTemplate() {
    const alert = await this.alertCtrl.create({
      header: 'Vorlage auswählen',
      inputs: this.templates.map(t => ({
        type: 'radio' as const,
        label: `${t.name} (${t.client_name})`,
        value: t.id
      })),
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Laden',
          handler: (templateId) => {
            if (templateId) {
              this.applyTemplate(templateId);
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private applyTemplate(templateId: number) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.workOrderForm.patchValue({
      client: template.client,
      work_object: template.work_object,
      work_type: template.work_type,
      work_description: template.work_description,
      work_days: template.work_days,
      work_schedule: template.work_schedule,
      customer_notes: template.customer_notes,
      internal_notes: template.internal_notes
    });

    // Load objects for the template's client
    if (template.client) {
      this.workOrderService.loadObjectsByClient(template.client)
        .pipe(takeUntil(this.destroy$))
        .subscribe(objects => {
          this.workObjects = objects;
          this.updateFilteredObjects(template.client);
        });
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  private async showError(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Fehler',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.workOrderForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
