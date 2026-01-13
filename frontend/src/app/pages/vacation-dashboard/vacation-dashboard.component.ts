import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent,
  IonButton,
  IonIcon,
  IonButtons,
  IonSpinner,
  IonProgressBar,
  IonList,
  IonItem,
  IonChip
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  calendar, 
  refresh, 
  alertCircle, 
  addCircle, 
  list, 
  time, 
  people, 
  informationCircle,
  checkmarkCircle,
  calendarNumber,
  documentText,
  flash,
  eye
} from 'ionicons/icons';

import { AbsenceService } from '../../core/services/absence.service';
import { AuthService } from '../../core/services/auth.service';
import { VacationSummary, Absence } from '../../core/interfaces/absence.types';

@Component({
  selector: 'app-vacation-dashboard',
  templateUrl: './vacation-dashboard.component.html',
  styleUrls: ['./vacation-dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonSpinner,
    IonProgressBar,
    IonList,
    IonItem,
    IonChip
  ]
})
export class VacationDashboardComponent implements OnInit {
  // Signals for reactive state management
  vacationSummary = signal<VacationSummary | null>(null);
  recentVacations = signal<Absence[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Computed properties
  currentYear = new Date().getFullYear();

  constructor(
    private absenceService: AbsenceService,
    private authService: AuthService,
    private router: Router
  ) {
    // Register icons
    addIcons({
      calendarOutline,
      calendar,
      refresh,
      alertCircle,
      addCircle,
      list,
      time,
      people,
      informationCircle,
      checkmarkCircle,
      calendarNumber,
      documentText,
      flash,
      eye
    });
  }

  ngOnInit() {
    this.loadVacationData();
    this.loadRecentVacations();
  }

  /**
   * Load vacation summary data
   */
  loadVacationData() {
    this.isLoading.set(true);
    this.error.set(null);

    this.absenceService.loadVacationSummary().subscribe({
      next: (summary) => {
        this.vacationSummary.set(summary);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading vacation data:', err);
        this.error.set('Fehler beim Laden der Urlaubsdaten');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Load recent vacation requests
   */
  loadRecentVacations() {
    // Get all absences and filter for vacation requests
    this.absenceService.loadMyAbsences();
    
    // Subscribe to absences signal and filter for vacation
    const allAbsences = this.absenceService.absences();
    const vacationRequests = allAbsences
      .filter(absence => absence.absence_type.name.toLowerCase().includes('urlaub'))
      .slice(0, 5); // Show only the 5 most recent
      
    this.recentVacations.set(vacationRequests);
  }

  /**
   * Refresh all data
   */
  refreshData() {
    this.loadVacationData();
    this.loadRecentVacations();
    this.absenceService.loadMyAbsences();
  }

  /**
   * Calculate vacation usage percentage
   */
  getVacationUsagePercentage(): number {
    const summary = this.vacationSummary();
    if (!summary || summary.total_entitlement === 0) return 0;
    
    return Math.round((summary.used_vacation_days / summary.total_entitlement) * 100);
  }

  /**
   * Calculate vacation usage ratio for progress bar
   */
  getVacationUsageRatio(): number {
    const summary = this.vacationSummary();
    if (!summary || summary.total_entitlement === 0) return 0;
    
    return summary.used_vacation_days / summary.total_entitlement;
  }

  /**
   * Get progress bar color based on usage
   */
  getProgressColor(): string {
    const ratio = this.getVacationUsageRatio();
    
    if (ratio < 0.5) return 'success';
    if (ratio < 0.8) return 'warning';
    return 'danger';
  }

  /**
   * Get status color for absence chips
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
      'pending_hr': 'HR Prüfung',
      'processed_hr': 'HR Bearbeitet'
    };
    
    return statusMap[status.toLowerCase()] || status;
  }

  /**
   * Check if current user is a manager
   */
  isManager(): boolean {
    const user = this.authService.activeUser();
    return user?.is_staff || user?.is_supervisor || false;
  }

  /**
   * Navigate to request vacation page
   */
  requestVacation() {
    this.router.navigate(['/absences/request']);
  }

  /**
   * Navigate to my absences page
   */
  viewMyAbsences() {
    this.router.navigate(['/absences/my']);
  }

  /**
   * Navigate to team absences (for managers)
   */
  viewTeamAbsences() {
    this.router.navigate(['/absences/team']);
  }

  /**
   * Open calendar view (placeholder)
   */
  openCalendarView() {
    // TODO: Implement calendar integration
  }
}
