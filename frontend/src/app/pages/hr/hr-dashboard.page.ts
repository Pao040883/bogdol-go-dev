import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonCard, IonCardContent, IonList, IonItem,
  IonLabel, IonIcon, IonButton, IonChip, IonGrid, IonRow, IonCol, 
  IonRefresher, IonRefresherContent, IonSearchbar, IonSelect, IonSelectOption, 
  IonToast
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  people, calendar, checkmarkCircle, warning, alertCircle, time,
  documentText, mail, person, business, medkit, sunny, refresh,
  filter, search, download, notifications
} from 'ionicons/icons';
import { AbsenceService } from '../../core/services/absence.service';
import { Absence, AbsenceFilters } from '../../core/interfaces/absence.types';

@Component({
  selector: 'app-hr-dashboard',
  templateUrl: './hr-dashboard.page.html',
  styleUrls: ['./hr-dashboard.page.scss'],
  standalone: true,
  imports: [
    IonToast, IonSearchbar, IonRefresherContent, IonRefresher, IonCol, IonRow, IonGrid, IonButton, IonIcon, IonLabel, IonItem, IonCardContent, IonCard, IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, IonSelect, IonSelectOption,
    CommonModule, FormsModule
  ],
})
export class HRDashboardPage implements OnInit {
  private readonly absenceService = inject(AbsenceService);

  // State Signals
  readonly hrAbsences = signal<Absence[]>([]);
  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly showToast = signal(false);
  readonly toastMessage = signal('');

  // Filter State
  readonly selectedType = signal<string>('all');
  readonly selectedMonth = signal<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Computed Values
  readonly filteredAbsences = computed(() => {
    const absences = this.hrAbsences();
    const search = this.searchTerm().toLowerCase();
    const typeFilter = this.selectedType();
    const monthFilter = this.selectedMonth();
    
    let filtered = absences.filter(absence => {
      // Only approved absences
      if (absence.status !== 'approved') return false;
      
      // Exclude public holidays completely
      if (absence.absence_type?.name === 'public_holiday') return false;
      
      // Type filter
      if (typeFilter !== 'all' && absence.absence_type?.name !== typeFilter) return false;
      
      // Month filter - check if absence overlaps with selected month
      if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        const absenceStart = new Date(absence.start_date);
        const absenceEnd = new Date(absence.end_date);
        
        if (absenceEnd < monthStart || absenceStart > monthEnd) return false;
      }
      
      return true;
    });
    
    // Search filter
    if (search) {
      filtered = filtered.filter(absence => 
        absence.user.username.toLowerCase().includes(search) ||
        absence.user.first_name?.toLowerCase().includes(search) ||
        absence.user.last_name?.toLowerCase().includes(search) ||
        absence.absence_type?.display_name?.toLowerCase().includes(search)
      );
    }
    
    // Sort by start date
    return filtered.sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  });

  readonly statistics = computed(() => {
    const allAbsences = this.hrAbsences().filter(a => 
      a.status === 'approved' && a.absence_type?.name !== 'public_holiday'
    );
    const filtered = this.filteredAbsences();
    
    // Calculate this month's absences
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthAbsences = allAbsences.filter(a => {
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      
      return !(end < monthStart || start > monthEnd);
    });
    
    return {
      pending_hr: 0, // Not applicable - all absences shown are already approved
      total_approved: allAbsences.length,
      this_month: thisMonthAbsences.length
    };
  });

  constructor() {
    addIcons({
      people, calendar, checkmarkCircle, warning, alertCircle, time,
      documentText, mail, person, business, medkit, sunny, refresh,
      filter, search, download, notifications
    });
  }

  ngOnInit() {
    this.loadHRData();
  }

  async loadHRData() {
    this.isLoading.set(true);
    try {
      const data = await this.absenceService.loadHRReview().toPromise();
      this.hrAbsences.set(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der HR-Daten:', error);
      this.showToastMessage('Fehler beim Laden der HR-Daten');
    } finally {
      this.isLoading.set(false);
    }
  }

  onSearchChanged(event: any) {
    this.searchTerm.set(event.detail.value);
  }

  onTypeFilterChanged(event: any) {
    this.selectedType.set(event.detail.value);
  }

  onMonthFilterChanged(event: any) {
    this.selectedMonth.set(event.detail.value);
  }

  async doRefresh(event: any) {
    await this.loadHRData();
    event.target.complete();
  }

  formatDateRange(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const formatter = new Intl.DateTimeFormat('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    if (startDate === endDate) {
      return formatter.format(start);
    }
    
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  getDurationText(absence: Absence): string {
    const days = absence.duration_days;
    return days === 1 ? '1 Tag' : `${days} Tage`;
  }

  getConflictSeverityColor(severity: string): string {
    const colors = {
      'low': 'success',
      'medium': 'warning',
      'high': 'danger'
    };
    return colors[severity as keyof typeof colors] || 'medium';
  }

  getUserDisplayName(absence: Absence): string {
    const user = absence.user;
    return user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username;
  }

  getUserDisplayNameFromUser(user: any): string {
    return user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username;
  }

  exportToCSV() {
    const absences = this.filteredAbsences();
    const headers = ['Mitarbeiter', 'Abwesenheitstyp', 'Von', 'Bis', 'Tage', 'Vertretung'];
    
    const csvContent = [
      headers.join(','),
      ...absences.map(absence => [
        this.getUserDisplayName(absence),
        absence.absence_type?.display_name || absence.reason || 'Unbekannt',
        absence.start_date,
        absence.end_date,
        absence.duration_days,
        absence.representative ? this.getUserDisplayNameFromUser(absence.representative) : ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `hr-abwesenheiten-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showToastMessage('CSV-Export erfolgreich erstellt');
  }

  private showToastMessage(message: string) {
    this.toastMessage.set(message);
    this.showToast.set(true);
  }

  getTypeIcon(typeName: string): string {
    const icons: { [key: string]: string } = {
      'vacation': 'sunny',
      'sick_leave': 'medkit',
      'public_holiday': 'ribbon',
      'special_leave': 'star'
    };
    return icons[typeName] || 'calendar';
  }

  getTypeColor(typeName: string): string {
    const colors: { [key: string]: string } = {
      'vacation': 'warning',
      'sick_leave': 'danger',
      'public_holiday': 'medium',
      'special_leave': 'tertiary'
    };
    return colors[typeName] || 'primary';
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'approved': 'success',
      'pending': 'warning',
      'rejected': 'danger',
      'hr_processed': 'medium'
    };
    return colors[status] || 'medium';
  }
}
