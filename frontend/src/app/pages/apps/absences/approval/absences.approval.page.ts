import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonIcon,
  IonMenuButton,
  IonButtons,
  ModalController,
} from '@ionic/angular/standalone';
import { AbsenceService } from 'src/app/core/services/absence.service';
import { RejectModalComponent } from './RejectModalComponent ';
import { TeamAbsenceCalendarComponent } from 'src/app/shared/components/team-absence-calendar/team-absence-calendar.component';
import { addIcons } from 'ionicons';
import { calendar, checkmarkCircle, closeCircle, time, person } from 'ionicons/icons';

@Component({
  selector: 'app-dashboard',
  templateUrl: './absences.approval.page.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonLabel,
    IonItem,
    IonList,
    IonContent,
    IonTitle,
    IonToolbar,
    IonHeader,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonIcon,
    IonMenuButton,
    IonButtons,
    TeamAbsenceCalendarComponent,
  ],
})
export class AbsencesApprovalPage implements OnInit {
  absenceService = inject(AbsenceService);
  approvals = this.absenceService.pendingApprovals;
  modalCtrl = inject(ModalController);

  // Signal für ausgewähltes Datum im Kalender
  selectedDate = signal<Date | null>(null);

  constructor() {
    addIcons({ time, calendar, checkmarkCircle, closeCircle, person });
  }

  ngOnInit() {
    // Lade ausstehende Genehmigungen beim Initialisieren
    this.absenceService.loadPendingApprovals();
    
    // Lade alle Team-Abwesenheiten für den Kalender
    this.absenceService.loadAllAbsences({
      status: ['pending', 'approved', 'hr_processed']
    });
  }

  approve(id: number) {
    this.absenceService.approve(id, { approved: true });
    // Liste neu laden nach erfolgreicher Genehmigung
    setTimeout(() => {
      this.absenceService.loadPendingApprovals();
      this.absenceService.loadAllAbsences({
        status: ['pending', 'approved', 'hr_processed']
      });
    }, 500);
  }

  async openRejectModal(id: number) {
    const modal = await this.modalCtrl.create({
      component: RejectModalComponent,
      componentProps: { id },
      cssClass: 'reject-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onWillDismiss();
    
    // Wenn abgelehnt wurde, Liste neu laden
    if (data?.rejected) {
      this.absenceService.loadPendingApprovals();
      this.absenceService.loadAllAbsences({
        status: ['pending', 'approved', 'hr_processed']
      });
    }
  }

  onDateSelected(date: Date) {
    this.selectedDate.set(date);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'pending': 'warning',
      'approved': 'success',
      'rejected': 'danger',
      'cancelled': 'medium',
    };
    return colors[status] || 'medium';
  }

  getAbsenceDuration(absence: any): number {
    const start = new Date(absence.start_date);
    const end = new Date(absence.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }
}
