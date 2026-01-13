import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonTextarea,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonSpinner,
  ModalController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  close, checkmarkCircle, closeCircle, calendar, person, time, 
  documentText, warning, informationCircle 
} from 'ionicons/icons';
import { AbsenceService } from '../../core/services/absence.service';
import { Absence } from '../../core/interfaces/absence.types';

@Component({
  selector: 'app-absence-approval-from-chat-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonItem,
    IonLabel,
    IonTextarea,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonSpinner,
  ],
  templateUrl: './absence-approval-from-chat-modal.component.html',
  styleUrls: ['./absence-approval-from-chat-modal.component.scss']
})
export class AbsenceApprovalFromChatModalComponent {
  @Input() absenceId!: number;
  @Input() metadata?: any;
  
  absence = signal<Absence | null>(null);
  conflictingAbsences = signal<Absence[]>([]);
  isLoading = signal(false);
  isSubmitting = signal(false);
  rejectionReason = signal('');
  comment = signal('');
  showRejectionReason = signal(false);
  
  constructor(
    private modalCtrl: ModalController,
    private absenceService: AbsenceService,
    private alertController: AlertController
  ) {
    addIcons({close,person,calendar,time,documentText,checkmarkCircle,informationCircle,closeCircle,warning});
  }
  
  ngOnInit() {
    this.loadAbsenceDetails();
  }
  
  private loadAbsenceDetails() {
    this.isLoading.set(true);
    
    // Load absence details
    this.absenceService.getAbsenceById(this.absenceId).subscribe({
      next: (absence) => {
        this.absence.set(absence);
        this.isLoading.set(false);
        // Note: Conflict checking removed for performance - can be added later if needed
      },
      error: (err) => {
        console.error('Fehler beim Laden der Abwesenheit:', err);
        this.isLoading.set(false);
      }
    });
  }
  
  approve() {
    const absence = this.absence();
    if (!absence || !absence.id) return;
    
    this.isSubmitting.set(true);
    
    this.absenceService.approveFromChat(absence.id, {
      comment: this.comment() || undefined
    }).subscribe({
      next: (updatedAbsence) => {
        console.log('✅ Abwesenheit genehmigt:', updatedAbsence);
        this.modalCtrl.dismiss({ approved: true, absence: updatedAbsence }, 'approved');
      },
      error: async (err) => {
        console.error('❌ Fehler bei Genehmigung:', err);
        const alert = await this.alertController.create({
          header: 'Fehler',
          message: err.error?.error || 'Unbekannter Fehler',
          buttons: ['OK']
        });
        await alert.present();
        this.isSubmitting.set(false);
      }
    });
  }
  
  async reject() {
    const absence = this.absence();
    const reason = this.rejectionReason().trim();
    
    if (!absence || !absence.id) return;
    
    if (!reason) {
      const alert = await this.alertController.create({
        header: 'Fehler',
        message: 'Bitte geben Sie eine Begründung für die Ablehnung ein.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }
    
    this.isSubmitting.set(true);
    
    this.absenceService.rejectFromChat(absence.id, {
      rejection_reason: reason,
      comment: this.comment() || undefined
    }).subscribe({
      next: (updatedAbsence) => {
        console.log('✅ Abwesenheit abgelehnt:', updatedAbsence);
        this.modalCtrl.dismiss({ approved: false, absence: updatedAbsence }, 'rejected');
      },
      error: async (err) => {
        console.error('❌ Fehler bei Ablehnung:', err);
        const alert = await this.alertController.create({
          header: 'Fehler',
          message: err.error?.error || 'Unbekannter Fehler',
          buttons: ['OK']
        });
        await alert.present();
        this.isSubmitting.set(false);
      }
    });
  }
  
  showRejectForm() {
    this.showRejectionReason.set(true);
  }
  
  close() {
    this.modalCtrl.dismiss(null, 'cancel');
  }
  
  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'warning',
      'approved': 'success',
      'rejected': 'danger',
      'cancelled': 'medium',
      'revision_requested': 'tertiary',
      'hr_processed': 'primary'
    };
    return colors[status] || 'medium';
  }
  
  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': 'Ausstehend',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'cancelled': 'Storniert',
      'revision_requested': 'Überarbeitung erforderlich',
      'hr_processed': 'HR bearbeitet'
    };
    return labels[status] || status;
  }
  
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  getChangeFields(changes: { [field: string]: { old: string; new: string } }): string[] {
    return Object.keys(changes);
  }
}
