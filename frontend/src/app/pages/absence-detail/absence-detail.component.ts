import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButtons, 
  IonBackButton, 
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  refresh,
  alertCircle,
  calendar,
  time,
  person,
  documentText,
  people,
  gitBranch,
  checkmarkCircle,
  business,
  closeCircle,
  create,
  trash,
  warning,
  informationCircle
} from 'ionicons/icons';

import { AbsenceService } from '../../core/services/absence.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Absence, AbsenceComment, AbsenceConflict } from '../../core/interfaces/absence.types';
import { AbsenceCommentsComponent } from '../../components/absence-comments/absence-comments.component';

@Component({
  selector: 'app-absence-detail',
  templateUrl: './absence-detail.component.html',
  styleUrls: ['./absence-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonChip,
    IonSpinner,
    AbsenceCommentsComponent
  ]
})
export class AbsenceDetailComponent implements OnInit {
  // State
  absence = signal<Absence | null>(null);
  commentsSignal = signal<AbsenceComment[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Route parameter
  private absenceId: number | null = null;

  // Computed properties
  currentUser = this.authService.activeUser;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private absenceService: AbsenceService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    // Register icons
    addIcons({
      refresh,
      alertCircle,
      calendar,
      time,
      person,
      documentText,
      people,
      gitBranch,
      checkmarkCircle,
      business,
      closeCircle,
      create,
      trash,
      warning,
      informationCircle
    });
  }

  ngOnInit() {
    // Get absence ID from route
    this.route.params.subscribe(params => {
      this.absenceId = +params['id'];
      if (this.absenceId) {
        this.loadAbsenceDetails();
      }
    });
  }

  /**
   * Load absence details including comments
   */
  loadAbsenceDetails() {
    if (!this.absenceId) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.absenceService.loadAbsence(this.absenceId).subscribe({
      next: (absence) => {
        this.absence.set(absence);
        
        // Set comments if available
        if (absence.comments) {
          this.commentsSignal.set(absence.comments);
        }
        
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading absence details:', err);
        this.error.set('Fehler beim Laden der Abwesenheitsdetails');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Refresh all data
   */
  refreshData() {
    this.loadAbsenceDetails();
  }

  /**
   * Get status color for chips
   */
  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'genehmigt':
        return 'success';
      case 'pending':
      case 'ausstehend':
        return 'warning';
      case 'rejected':
      case 'abgelehnt':
        return 'danger';
      case 'hr_processed':
        return 'tertiary';
      case 'cancelled':
      case 'storniert':
        return 'medium';
      default:
        return 'primary';
    }
  }

  /**
   * Get localized status label
   */
  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ausstehend',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'cancelled': 'Storniert',
      'hr_processed': 'HR Bearbeitet',
      'revision_requested': 'Revision angefordert'
    };
    
    return statusMap[status.toLowerCase()] || status;
  }

  /**
   * Check if workflow details should be shown
   */
  showWorkflowDetails(): boolean {
    const absence = this.absence();
    return !!(absence?.approved_by || absence?.hr_processed || absence?.rejected_by);
  }

  /**
   * Check if action buttons should be shown
   */
  showActionButtons(): boolean {
    return this.canApproveReject() || this.canProcessHR() || this.canCreateRevision() || this.canCancel();
  }

  /**
   * Check if current user can approve/reject
   */
  canApproveReject(): boolean {
    const user = this.currentUser();
    const absence = this.absence();
    
    if (!user || !absence) return false;
    
    // Only supervisors can approve, and only pending absences
    return user.is_supervisor && absence.status === 'pending';
  }

  /**
   * Check if current user can process HR
   */
  canProcessHR(): boolean {
    const user = this.currentUser();
    const absence = this.absence();
    
    if (!user || !absence) return false;
    
    // Only HR staff can process, and only approved absences
    return user.is_staff && absence.status === 'approved' && !absence.hr_processed;
  }

  /**
   * Check if current user can create revision
   */
  canCreateRevision(): boolean {
    const user = this.currentUser();
    const absence = this.absence();
    
    if (!user || !absence) return false;
    
    // Only the owner can create revisions for approved/rejected absences
    return absence.user.id === user.id && 
           (absence.status === 'approved' || absence.status === 'rejected');
  }

  /**
   * Check if current user can cancel
   */
  canCancel(): boolean {
    const user = this.currentUser();
    const absence = this.absence();
    
    if (!user || !absence) return false;
    
    // Only the owner can cancel pending absences
    return absence.user.id === user.id && absence.status === 'pending';
  }

  /**
   * Approve absence
   */
  async approveAbsence() {
    // TODO: Implement approval dialog with comment
  }

  /**
   * Reject absence
   */
  async rejectAbsence() {
    // TODO: Implement rejection dialog with reason
  }

  /**
   * Process HR
   */
  async processHR() {
    // TODO: Implement HR processing dialog
  }

  /**
   * Create revision
   */
  async createRevision() {
    // TODO: Implement revision creation
  }

  /**
   * Cancel absence
   */
  async cancelAbsence() {
    // TODO: Implement cancellation confirmation
  }

  /**
   * Get conflict severity color
   */
  getConflictSeverityColor(severity: string): string {
    switch (severity) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'danger';
      default:
        return 'medium';
    }
  }

  /**
   * Get conflict type label
   */
  getConflictTypeLabel(type: string): string {
    const typeMap: { [key: string]: string } = {
      'team_overlap': 'Team-Überschneidung',
      'representative_conflict': 'Vertretungskonflikt',
      'department_shortage': 'Abteilungsengpass',
      'critical_period': 'Kritischer Zeitraum'
    };
    
    return typeMap[type] || type;
  }
}
