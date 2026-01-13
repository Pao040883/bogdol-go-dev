import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon,
  IonItem, IonLabel, IonTextarea, IonList, IonBadge, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, checkmarkCircle, closeCircle, calendar, person, time } from 'ionicons/icons';
import { AbsenceService } from '../../../core/services/absence.service';

@Component({
  selector: 'app-absence-approval-modal',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon,
    IonItem, IonLabel, IonTextarea, IonList
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Abwesenheit genehmigen</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div *ngIf="absence" class="absence-details">
        <h2>{{ absence.user.first_name }} {{ absence.user.last_name }}</h2>
        
        <ion-list>
          <ion-item>
            <ion-icon name="calendar" slot="start" color="primary"></ion-icon>
            <ion-label>
              <p>Zeitraum</p>
              <h3>{{ absence.start_date | date:'dd.MM.yyyy' }} - {{ absence.end_date | date:'dd.MM.yyyy' }}</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-icon name="time" slot="start" color="primary"></ion-icon>
            <ion-label>
              <p>Dauer</p>
              <h3>{{ getAbsenceDuration(absence) }} Tag(e)</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p>Typ</p>
              <h3>{{ absence.absence_type.display_name }}</h3>
            </ion-label>
          </ion-item>

          <ion-item *ngIf="absence.reason">
            <ion-label>
              <p>Begründung</p>
              <p class="ion-text-wrap">{{ absence.reason }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <div class="action-section">
          <h3>Ablehnungsgrund (optional)</h3>
          <ion-textarea
            [(ngModel)]="rejectionReason"
            placeholder="Grund für die Ablehnung eingeben..."
            rows="3">
          </ion-textarea>

          <div class="buttons">
            <ion-button 
              expand="block" 
              color="success" 
              (click)="approve()">
              <ion-icon name="checkmark-circle" slot="start"></ion-icon>
              Genehmigen
            </ion-button>

            <ion-button 
              expand="block" 
              color="danger" 
              fill="outline"
              (click)="reject()">
              <ion-icon name="close-circle" slot="start"></ion-icon>
              Ablehnen
            </ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .absence-details {
      h2 {
        margin-top: 0;
        color: var(--ion-color-primary);
      }
    }

    .action-section {
      margin-top: 24px;

      h3 {
        font-size: 0.9rem;
        color: var(--ion-color-medium);
        margin-bottom: 8px;
      }

      .buttons {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
    }
  `]
})
export class AbsenceApprovalModalComponent {
  @Input() absence: any;
  
  rejectionReason = '';
  
  private modalCtrl = inject(ModalController);
  private absenceService = inject(AbsenceService);

  constructor() {
    addIcons({ close, checkmarkCircle, closeCircle, calendar, person, time });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  approve() {
    if (this.absence?.id) {
      this.absenceService.approve(this.absence.id, { approved: true });
      this.modalCtrl.dismiss({ approved: true });
    }
  }

  reject() {
    if (this.absence?.id) {
      this.absenceService.rejectAbsence(this.absence.id, this.rejectionReason || 'Abgelehnt');
      this.modalCtrl.dismiss({ rejected: true });
    }
  }

  getAbsenceDuration(absence: any): number {
    const start = new Date(absence.start_date);
    const end = new Date(absence.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }
}
