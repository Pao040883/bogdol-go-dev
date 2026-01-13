import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { 
  IonModal, IonButton, IonTextarea, IonHeader, IonToolbar, 
  IonTitle, IonContent, IonButtons, IonIcon, ModalController 
} from '@ionic/angular/standalone';
import { AbsenceService } from 'src/app/core/services/absence.service';
import { addIcons } from 'ionicons';
import { closeOutline, sendOutline } from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-reject-modal',
  imports: [FormsModule, IonButton, IonButtons, IonTextarea, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon],
  template: `
    <ion-header>
      <ion-toolbar color="danger">
        <ion-title>Abwesenheit ablehnen</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="info-text">
        <strong>Hinweis:</strong> Bitte geben Sie eine Begründung für die Ablehnung an. 
        Diese wird dem Mitarbeiter mitgeteilt.
      </p>
      
      <ion-textarea
        [(ngModel)]="reason"
        placeholder="Begründung für die Ablehnung eingeben..."
        rows="6"
        [counter]="true"
        maxlength="500"
        class="rejection-textarea"
        [class.error]="!reason.trim() && attempted"
      ></ion-textarea>
      
      @if (!reason.trim() && attempted) {
        <p class="error-message">Eine Begründung ist erforderlich.</p>
      }
      
      <div class="button-group">
        <ion-button 
          expand="block" 
          color="medium" 
          fill="outline"
          (click)="cancel()">
          Abbrechen
        </ion-button>
        <ion-button 
          expand="block" 
          color="danger"
          (click)="reject()"
          [disabled]="!reason.trim()">
          <ion-icon slot="start" name="send-outline"></ion-icon>
          Ablehnen
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .info-text {
      margin-bottom: 16px;
      padding: 12px;
      background: var(--ion-color-light);
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .rejection-textarea {
      margin-bottom: 8px;
      --padding-start: 12px;
      --padding-end: 12px;
      --padding-top: 12px;
      --padding-bottom: 12px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 8px;
      
      &.error {
        border-color: var(--ion-color-danger);
      }
    }

    .error-message {
      color: var(--ion-color-danger);
      font-size: 0.875rem;
      margin-top: 4px;
      margin-bottom: 12px;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 16px;

      ion-button {
        flex: 1;
      }
    }
  `]
})
export class RejectModalComponent {
  @Input() id!: number;
  reason = '';
  attempted = false;
  absenceService = inject(AbsenceService);
  modalCtrl = inject(ModalController);

  constructor() {
    addIcons({ closeOutline, sendOutline });
  }

  reject() {
    this.attempted = true;
    
    if (!this.reason.trim()) {
      return;
    }

    this.absenceService.rejectAbsence(this.id, this.reason.trim())
      .subscribe({
        next: () => {
          this.modalCtrl.dismiss({ rejected: true });
        },
        error: (err: any) => {
          console.error('Fehler beim Ablehnen:', err);
        }
      });
  }

  cancel() {
    this.modalCtrl.dismiss({ rejected: false });
  }
}

