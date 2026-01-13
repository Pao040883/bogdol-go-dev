import { Component, inject, signal, computed, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardContent, IonButton, IonIcon, IonBadge, IonLabel,
  IonChip, IonSelect, IonSelectOption, IonToolbar, IonButtons, IonTitle, ModalController, IonPopover, IonContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, peopleOutline, calendarOutline, closeCircleOutline, personOutline, 
         medkitOutline, homeOutline, airplaneOutline, timeOutline, ribbonOutline } from 'ionicons/icons';
import { AbsenceService } from '../../../core/services/absence.service';
import { UserPhonebookService } from '../../../core/services/user-phonebook.service';
import { AuthService } from '../../../core/services/auth.service';
import { PublicHolidaysService } from '../../../core/services/public-holidays.service';
import { AbsenceType } from '../../../core/interfaces/absence.types';
import { AbsenceApprovalModalComponent } from '../absence-approval-modal/absence-approval-modal.component';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isPublicHoliday?: boolean;
  holidayName?: string;
}

@Component({
  selector: 'app-team-absence-calendar',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonCard, IonCardHeader, IonCardContent, IonButton, IonIcon, 
    IonBadge, IonLabel, IonChip, IonSelect, IonSelectOption, IonToolbar, IonButtons, IonTitle
  ],
  templateUrl: './team-absence-calendar.component.html',
  styleUrls: ['./team-absence-calendar.component.scss']
})
export class TeamAbsenceCalendarComponent implements OnInit {
  readonly absenceService = inject(AbsenceService);
  readonly phonebookService = inject(UserPhonebookService);
  readonly authService = inject(AuthService);
  readonly holidaysService = inject(PublicHolidaysService);
  private modalCtrl = inject(ModalController);
  @Input() showFilters = true;
  currentDate = signal<Date>(new Date());
  selectedDepartment = signal<string | null>(null);
  currentMonthName = computed(() => this.currentDate().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
  
  // Nur Mitarbeiter aus der gleichen Abteilung/Division wie der eingeloggte Benutzer
  teamMembers = computed(() => {
    const currentUser = this.authService.activeUser();
    const allEntries = this.phonebookService.entries();
    
    if (!currentUser) return allEntries;
    
    // Wenn Benutzer Supervisor ist, zeige alle aus seiner Abteilung/Division
    if (currentUser.is_supervisor) {
      return allEntries.filter(entry => 
        entry.department === currentUser.department || 
        (entry as any).division === (currentUser as any).division
      );
    }
    
    // Normale Benutzer sehen nur ihre eigene Abteilung
    return allEntries.filter(entry => 
      entry.department === currentUser.department
    );
  });
  availableDepartments = computed(() => {
    const departments = new Set<string>();
    this.teamMembers().forEach((m: any) => { if (m.department) departments.add(m.department); });
    return Array.from(departments).sort();
  });
  filteredTeamMembers = computed(() => {
    const dept = this.selectedDepartment();
    return !dept ? this.teamMembers() : this.teamMembers().filter((m: any) => m.department === dept);
  });
  calendarDays = computed(() => {
    const date = this.currentDate(), year = date.getFullYear(), month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate(), days: CalendarDay[] = [], today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day), dayOfWeek = currentDay.getDay();
      const isHoliday = this.holidaysService.isPublicHoliday(currentDay);
      const holidayName = this.holidaysService.getHolidayName(currentDay);
      days.push({ 
        date: currentDay, 
        dayNumber: day, 
        isCurrentMonth: true, 
        isToday: currentDay.getTime() === today.getTime(), 
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isPublicHoliday: isHoliday,
        holidayName: holidayName || undefined
      });
    }
    return days;
  });
  constructor() { addIcons({chevronBackOutline,chevronForwardOutline,calendarOutline,peopleOutline,closeCircleOutline,personOutline,medkitOutline,homeOutline,airplaneOutline,timeOutline,ribbonOutline}); }
  ngOnInit() {
    this.phonebookService.loadPhonebook();
    if (this.absenceService.absences().length === 0) this.absenceService.loadAllAbsences();
  }
  previousMonth() { const c = this.currentDate(); this.currentDate.set(new Date(c.getFullYear(), c.getMonth() - 1, 1)); }
  nextMonth() { const c = this.currentDate(); this.currentDate.set(new Date(c.getFullYear(), c.getMonth() + 1, 1)); }
  goToToday() { this.currentDate.set(new Date()); }
  
  getDayName(date: Date): string { return date.toLocaleDateString('de-DE', { weekday: 'short' }); }
  getInitials(emp: any): string {
    if (emp.first_name && emp.last_name) {
      return `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase();
    }
    if (emp.email) {
      return emp.email.substring(0, 2).toUpperCase();
    }
    return '??';
  }
  hasAbsenceInMonth(employeeId: number): boolean {
    const absences = this.absenceService.absences(), month = this.currentDate().getMonth(), year = this.currentDate().getFullYear();
    return absences.some((a: any) => {
      if (a.user.id !== employeeId) return false;
      const start = new Date(a.start_date), end = new Date(a.end_date);
      return (start.getMonth() === month && start.getFullYear() === year) || (end.getMonth() === month && end.getFullYear() === year) ||
             (start <= new Date(year, month, 1) && end >= new Date(year, month + 1, 0));
    });
  }
  getAbsenceCount(employeeId: number): number {
    const absences = this.absenceService.absences(), month = this.currentDate().getMonth(), year = this.currentDate().getFullYear();
    return absences.filter((a: any) => {
      if (a.user.id !== employeeId) return false;
      const start = new Date(a.start_date), end = new Date(a.end_date);
      return (start.getMonth() === month && start.getFullYear() === year) || (end.getMonth() === month && end.getFullYear() === year) ||
             (start <= new Date(year, month, 1) && end >= new Date(year, month + 1, 0));
    }).length;
  }
  hasAbsenceOnDate(employeeId: number, date: Date): boolean {
    const absences = this.absenceService.absences(), checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return absences.some((a: any) => {
      if (a.user.id !== employeeId) return false;
      const start = new Date(a.start_date), end = new Date(a.end_date);
      start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  }
  getAbsenceCellColor(employeeId: number, date: Date): string {
    const absence = this.getAbsenceForDate(employeeId, date);
    if (!absence) return '';
    const type = absence.absence_type, status = absence.status;
    if (status === 'pending') return 'rgba(255, 193, 7, 0.5)';
    if (status === 'rejected') return 'rgba(244, 67, 54, 0.5)';
    if (type.name === 'vacation') return 'rgba(76, 175, 80, 0.6)';
    if (type.name === 'sick_leave') return 'rgba(156, 39, 176, 0.6)';
    if (type.name === 'home_office') return 'rgba(33, 150, 243, 0.6)';
    return 'rgba(158, 158, 158, 0.5)';
  }
  getAbsenceForDate(employeeId: number, date: Date): any {
    const absences = this.absenceService.absences(), checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return absences.find((a: any) => {
      if (a.user.id !== employeeId) return false;
      const start = new Date(a.start_date), end = new Date(a.end_date);
      start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  }
  getAbsenceTooltip(employeeId: number, date: Date): string {
    const absence = this.getAbsenceForDate(employeeId, date);
    if (!absence) return '';
    const type = absence.absence_type.display_name, status = this.getStatusLabel(absence.status);
    const start = new Date(absence.start_date).toLocaleDateString('de-DE'), end = new Date(absence.end_date).toLocaleDateString('de-DE');
    return `${type} (${status})\n${start} - ${end}`;
  }
  getStatusLabel(status: string): string {
    const labels: any = { pending: 'Ausstehend', approved: 'Genehmigt', rejected: 'Abgelehnt', hr_processed: 'HR bearbeitet', cancelled: 'Storniert' };
    return labels[status] || status;
  }
  onCellClick(employee: any, date: Date) {
    const absence = this.getAbsenceForDate(employee.id, date);
    if (absence) {
      this.openApprovalModal(absence);
    }
  }

  async openApprovalModal(absence: any) {
    const modal = await this.modalCtrl.create({
      component: AbsenceApprovalModalComponent,
      componentProps: { absence },
      cssClass: 'absence-approval-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onWillDismiss();
    
    // Nach Genehmigung/Ablehnung Daten neu laden
    if (data?.approved || data?.rejected) {
      this.absenceService.loadAllAbsences();
    }
  }

  getAbsenceIcon(absence: any): string {
    const typeName = absence.absence_type.name;
    if (typeName === 'sick_leave') return 'medkit-outline';
    if (typeName === 'home_office') return 'home-outline';
    if (typeName === 'vacation') return 'airplane-outline';
    if (typeName === 'public_holiday') return 'ribbon-outline';
    return 'time-outline';
  }

  getAbsenceIconColor(absence: any): string {
    const status = absence.status;
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'danger';
    if (status === 'approved' || status === 'hr_processed') {
      const typeName = absence.absence_type.name;
      if (typeName === 'sick_leave') return 'danger';
      if (typeName === 'home_office') return 'primary';
      if (typeName === 'vacation') return 'success';
      if (typeName === 'public_holiday') return 'medium';
    }
    return 'medium';
  }
  hasTypeInCurrentView(typeId: number): boolean {
    const absences = this.absenceService.absences(), month = this.currentDate().getMonth(), year = this.currentDate().getFullYear();
    return absences.some((a: any) => {
      if (a.absence_type.id !== typeId) return false;
      const start = new Date(a.start_date), end = new Date(a.end_date);
      return (start.getMonth() === month && start.getFullYear() === year) || (end.getMonth() === month && end.getFullYear() === year);
    });
  }
  getTypeColor(type: AbsenceType): string {
    if (type.name === 'vacation') return '#4CAF50';
    if (type.name === 'sick_leave') return '#9C27B0';
    if (type.name === 'home_office') return '#2196F3';
    return '#9E9E9E';
  }
}
