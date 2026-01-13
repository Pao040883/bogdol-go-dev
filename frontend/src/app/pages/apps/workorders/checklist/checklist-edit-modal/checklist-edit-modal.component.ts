import { Component, OnInit, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { WorkOrderService } from '../../../../../core/services/workorder.service';
import { RecurringWorkOrderChecklist } from '../../../../../core/interfaces/workorder.types';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-checklist-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ mode === 'create' ? 'Neuer Eintrag' : 'Eintrag bearbeiten' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <form [formGroup]="form" class="ion-padding">
        <ion-item>
          <ion-label position="stacked">O-Nummer *</ion-label>
          <ion-input 
            formControlName="object_number" 
            placeholder="z.B. O-12345">
          </ion-input>
        </ion-item>
        @if (form.get('object_number')?.invalid && form.get('object_number')?.touched) {
          <ion-text color="danger" class="error-text">
            <small>O-Nummer ist erforderlich</small>
          </ion-text>
        }

        <ion-item>
          <ion-label position="stacked">Objektbeschreibung *</ion-label>
          <ion-input 
            formControlName="object_description" 
            placeholder="z.B. Hauptgebäude">
          </ion-input>
        </ion-item>
        @if (form.get('object_description')?.invalid && form.get('object_description')?.touched) {
          <ion-text color="danger" class="error-text">
            <small>Objektbeschreibung ist erforderlich</small>
          </ion-text>
        }

        <ion-item>
          <ion-label position="stacked">P-Nummer *</ion-label>
          <ion-input 
            formControlName="project_number" 
            placeholder="z.B. P-67890">
          </ion-input>
        </ion-item>
        @if (form.get('project_number')?.invalid && form.get('project_number')?.touched) {
          <ion-text color="danger" class="error-text">
            <small>P-Nummer ist erforderlich</small>
          </ion-text>
        }

        <ion-item>
          <ion-label position="stacked">Debitor-Nr</ion-label>
          <ion-input 
            formControlName="debitor_number" 
            placeholder="z.B. 12345">
          </ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">SR-Rechnungsnummer</ion-label>
          <ion-input 
            formControlName="sr_invoice_number" 
            placeholder="z.B. SR-2025-01">
          </ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Service Manager</ion-label>
          <ion-select 
            formControlName="service_manager" 
            placeholder="Bitte wählen..."
            interface="popover">
            <ion-select-option [value]="null">-- Kein Service Manager --</ion-select-option>
            @for (profile of activeUsers; track profile.id) {
              <ion-select-option [value]="profile.id">
                {{ profile.full_name }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Zugeordneter Faktur-Mitarbeiter</ion-label>
          <ion-select 
            formControlName="assigned_billing_user" 
            placeholder="Wird automatisch gesetzt..."
            interface="popover">
            <ion-select-option [value]="null">-- Auto-Zuweisung --</ion-select-option>
            @for (profile of activeUsers; track profile.id) {
              <ion-select-option [value]="profile.id">
                {{ profile.full_name }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Bemerkung</ion-label>
          <ion-textarea 
            formControlName="notes" 
            placeholder="Zusätzliche Informationen"
            rows="3">
          </ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Gültig von (optional)</ion-label>
          <ion-input 
            type="date" 
            formControlName="valid_from">
          </ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Gültig bis (optional)</ion-label>
          <ion-input 
            type="date" 
            formControlName="valid_until">
          </ion-input>
        </ion-item>

        <div class="info-box">
          <ion-icon name="information-circle-outline"></ion-icon>
          <div>
            <strong>Zuständigkeiten & SR-Nummern</strong>
            <p>Service Manager wird manuell zugeordnet. Faktur-Mitarbeiter wird automatisch 
               beim Erstellen gesetzt (kann überschrieben werden). SR-Rechnungsnummer für 
               Sammelrechnungen. Gültigkeitszeitraum optional (leer = unbegrenzt).</p>
          </div>
        </div>

        @if (errorMessage) {
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <ion-text color="danger">
                <p>{{ errorMessage }}</p>
              </ion-text>
            </ion-label>
          </ion-item>
        }
      </form>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            Abbrechen
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button 
            [disabled]="form.invalid || isSubmitting" 
            (click)="save()">
            @if (isSubmitting) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              {{ mode === 'create' ? 'Erstellen' : 'Speichern' }}
            }
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .error-text {
      display: block;
      padding: 4px 16px;
    }

    .info-box {
      display: flex;
      gap: 12px;
      margin: 16px;
      padding: 12px;
      background: var(--ion-color-light);
      border-radius: 8px;
      
      ion-icon {
        flex-shrink: 0;
        color: var(--ion-color-primary);
        font-size: 24px;
        margin-top: 2px;
      }
      
      div {
        flex: 1;
        
        strong {
          display: block;
          margin-bottom: 4px;
          color: var(--ion-color-primary);
        }
        
        p {
          margin: 0;
          font-size: 13px;
          color: var(--ion-color-medium);
        }
      }
    }
  `]
})
export class ChecklistEditModalComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() item?: RecurringWorkOrderChecklist;

  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private workorderService = inject(WorkOrderService);
  private http = inject(HttpClient);

  form!: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  activeUsers: any[] = [];

  ngOnInit() {
    this.loadUsers();
    this.initForm();
  }

  loadUsers() {
    // Use /api/profiles/ endpoint which is accessible to all authenticated users
    this.http.get<any>(`${environment.apiUrl}/profiles/`).subscribe({
      next: (response) => {
        this.activeUsers = response.results || response;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.activeUsers = [];
      }
    });
  }

  initForm() {
    this.form = this.fb.group({
      object_number: [this.item?.object_number || '', Validators.required],
      object_description: [this.item?.object_description || '', Validators.required],
      project_number: [this.item?.project_number || '', Validators.required],
      debitor_number: [this.item?.debitor_number || ''],
      sr_invoice_number: [this.item?.sr_invoice_number || ''],
      service_manager: [this.item?.service_manager || null],
      assigned_billing_user: [this.item?.assigned_billing_user || null],
      notes: [this.item?.notes || ''],
      valid_from: [this.item?.valid_from || null],
      valid_until: [this.item?.valid_until || null]
    });
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const data = this.form.value;

    const operation = this.mode === 'create'
      ? this.workorderService.createChecklistItem(data)
      : this.workorderService.updateChecklistItem(this.item!.id!, data);

    operation.subscribe({
      next: () => {
        this.modalCtrl.dismiss({ saved: true });
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || err.error?.message || 'Fehler beim Speichern';
        this.isSubmitting = false;
      }
    });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
