import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonLabel,
  IonItem,
  IonIcon,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonChip,
  IonTextarea,
  IonMenuButton,
  IonFooter,
  IonCard,
  IonCardHeader, 
  IonCardTitle,
  IonCardContent,
  IonCardSubtitle,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  IonToggle,
  AlertController,
  ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  add, addCircle, airplane, alertCircle, archive, ban, business, calendar, calendarOutline,
  chatbox, chatbubbles, checkmarkCircle, checkmarkDone, chevronBack, chevronDown, 
  chevronForward, chevronUp, close, closeCircle, create, documentText, documentTextOutline,
  eye, heart, helpCircle, home, list, medkit, medkitOutline, people, person, ribbon, ribbonOutline, 
  school, send, shieldCheckmark, star, statsChart, sunny, sunnyOutline, time, timeOutline, trash } from 'ionicons/icons';
import { AbsenceService } from 'src/app/core/services/absence.service';
import { UsersService } from 'src/app/core/services/users.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { PublicHolidaysService } from 'src/app/core/services/public-holidays.service';
import { Users } from 'src/app/core/interfaces/users';
import { AbsenceCreateRequest, Absence, AbsenceComment, CommentRequest, User } from 'src/app/core/interfaces/absence.types';
import { AbsenceDetailModalComponent } from 'src/app/components/absence-detail-modal/absence-detail-modal.component';
import { AbsenceCreateModalComponent } from 'src/app/components/absence-create-modal/absence-create-modal.component';
import { HRAssignmentModalComponent } from 'src/app/components/hr-assignment-modal/hr-assignment-modal.component';

interface CalendarDay {
  date: string;
  dayNumber: number;
  currentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  absences: Absence[];
}

@Component({
  selector: 'app-absences',
  templateUrl: './absences.page.html',
  styleUrls: ['./absences.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonMenuButton,

    IonToggle,
    AbsenceDetailModalComponent,
    AbsenceCreateModalComponent
  ],
})
export class AbsencesPage {
  year = signal(new Date().getFullYear());
  readonly service = inject(AbsenceService);
  private readonly userService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly holidaysService = inject(PublicHolidaysService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly modalController = inject(ModalController);
  
  // Tab-Konfiguration
  // Entfernt - nicht mehr benötigt für neue Layout-Struktur
  
  // Signals für reactive state
  absences = this.service.absences;
  absenceTypes = this.service.absenceTypes;
  isSubmitting = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  search = signal('');
  selectedFilter = signal<'all' | 'pending' | 'approved'>('all');
  expandedCards = signal<Set<number>>(new Set());
  showCreateModal = signal(false);
  editingAbsence = signal<Absence | null>(null);
  
  // Computed signals for filtering
  filteredAbsences = computed(() => {
    const absences = this.absences();
    const currentYear = this.year();
    return absences.filter(absence => {
      const isCurrentYear = this.checkYear(absence.start_date!, currentYear);
      return isCurrentYear;
    });
  });

  archivedAbsences = computed(() => {
    const absences = this.absences();
    const currentYear = this.year();
    return absences.filter(absence => {
      const isOlderYear = !this.checkYear(absence.start_date!, currentYear);
      return isOlderYear;
    });
  });

  // Computed vacation statistics for current year
  vacationStats = computed(() => {
    const activeUser = this.authService.activeUser();
    if (!activeUser) {
      return {
        entitlement: 0,
        carryover: 0,
        totalAvailable: 0,
        usedDays: 0,
        remaining: 0
      };
    }

    // Cast to extended User interface
    const currentUser = activeUser as unknown as User;
    const selectedYear = this.year();
    const userVacationYear = currentUser?.vacation_year || new Date().getFullYear();
    const currentYear = new Date().getFullYear();
    
    const currentYearAbsences = this.filteredAbsences().filter(a => 
      a.absence_type?.name === 'vacation' && 
      ['pending', 'approved', 'hr_processed'].includes(a.status)
    );
    
    const usedDays = currentYearAbsences.reduce((sum, absence) => {
      // Verwende das manuelle manual_duration_days Feld falls vorhanden, sonst automatische Berechnung
      const days = absence.manual_duration_days || this.calculateWeekdays(absence.start_date!, absence.end_date!);
      return sum + days;
    }, 0);

    // Basis-Urlaubsanspruch (gilt für alle Jahre)
    const baseEntitlement = currentUser?.vacation_entitlement || 30;
    
    // Resturlaub-Logik:
    let carryover = 0;
    if (selectedYear === userVacationYear) {
      // Aktuelles gespeichertes Jahr: Zeige gespeicherten Resturlaub
      carryover = currentUser?.carryover_vacation || 0;
    } else if (selectedYear > currentYear) {
      // Zukünftige Jahre (die noch nicht begonnen haben): Kein Resturlaub anzeigen
      carryover = 0;
    } else if (selectedYear > userVacationYear && selectedYear <= currentYear) {
      // Vergangene Jahre zwischen User-Jahr und aktuellem Jahr: Berechne Resturlaub
      const previousYearStats = this.calculateYearStats(selectedYear - 1);
      carryover = previousYearStats.remaining > 0 ? previousYearStats.remaining : 0;
    }
    
    const entitlement = baseEntitlement;
    const totalAvailable = entitlement + carryover;
    const remaining = totalAvailable - usedDays;

    return {
      entitlement,
      carryover,
      totalAvailable,
      usedDays,
      remaining
    };
  });
  
  // Helper method to calculate stats for a specific year
  private calculateYearStats(year: number): { usedDays: number; remaining: number } {
    const currentUser = this.authService.activeUser() as unknown as User;
    const baseEntitlement = currentUser?.vacation_entitlement || 30;
    const carryover = currentUser?.carryover_vacation || 0;
    
    // Filter absences for specific year
    const yearAbsences = this.absences().filter(a => {
      if (!a.start_date || a.absence_type?.name !== 'vacation') return false;
      if (!['pending', 'approved', 'hr_processed'].includes(a.status)) return false;
      const absenceYear = new Date(a.start_date).getFullYear();
      return absenceYear === year;
    });
    
    const usedDays = yearAbsences.reduce((sum, absence) => {
      const days = absence.manual_duration_days || this.calculateWeekdays(absence.start_date!, absence.end_date!);
      return sum + days;
    }, 0);
    
    const totalAvailable = baseEntitlement + (year === currentUser?.vacation_year ? carryover : 0);
    const remaining = totalAvailable - usedDays;
    
    return { usedDays, remaining };
  }
  
  // Communication signals
  expandedAbsences = signal<Set<number>>(new Set());
  absenceComments = signal<Map<number, AbsenceComment[]>>(new Map());
  quickCommentForms = signal<Map<number, { comment: string; type: 'employee' | 'supervisor' | 'hr'; isInternal: boolean }>>(new Map());
  submittingComments = signal<Set<number>>(new Set());
  
  // Modal signals
  selectedAbsence = signal<Absence | null>(null);
  isModalOpen = signal(false);
  showQuickCommentForm = signal<number | null>(null);

  // Create absence form
  createAbsenceForm = this.fb.group({
    absence_type_id: [1, Validators.required],
    start_date: [this.formatDateForInput(new Date()), Validators.required],
    end_date: [this.formatDateForInput(new Date()), Validators.required],
    reason: [''],
    representative_id: [null as number | null]
  });

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Computed: Working days for selected period
  selectedPeriodWorkingDays = computed(() => {
    const startStr = this.createAbsenceForm.value.start_date;
    const endStr = this.createAbsenceForm.value.end_date;
    
    if (!startStr || !endStr) return 0;
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    return this.holidaysService.countWorkingDays(start, end);
  });

  constructor() {
    addIcons({
      add, addCircle, airplane, alertCircle, archive, ban, business, calendar, calendarOutline,
      chatbox, chatbubbles, checkmarkCircle, checkmarkDone, chevronBack, chevronDown,
      chevronForward, chevronUp, close, closeCircle, create, documentText, documentTextOutline,
      eye, heart, helpCircle, home, list, medkit, medkitOutline, people, person, ribbon, ribbonOutline, 
      school, send, shieldCheckmark, star, statsChart, sunny, sunnyOutline, time, timeOutline, trash
    });
    // Direkte Initialisierung - lade Absences für aktuelles Jahr
    this.service.load(this.year());
  }

  checkYear(date: string, year: number) {
    const dateYear = new Date(date).getFullYear(); 
    return dateYear === year;
  }

  // Year navigation
  previousYear(): void {
    this.year.update(y => {
      const newYear = y - 1;
      this.service.load(newYear); // Reload absences with year parameter
      return newYear;
    });
  }

  nextYear(): void {
    this.year.update(y => {
      const newYear = y + 1;
      this.service.load(newYear); // Reload absences with year parameter
      return newYear;
    });
  }

  // Absence type statistics
  visibleAbsenceTypes = signal<Set<string>>(new Set(['vacation', 'sick_leave', 'public_holiday']));

  toggleAbsenceTypeVisibility(type: string): void {
    const visible = this.visibleAbsenceTypes();
    const newVisible = new Set(visible);
    if (newVisible.has(type)) {
      newVisible.delete(type);
    } else {
      newVisible.add(type);
    }
    this.visibleAbsenceTypes.set(newVisible);
  }

  isAbsenceTypeVisible(type: string): boolean {
    return this.visibleAbsenceTypes().has(type);
  }

  getAbsenceTypeStats() {
    const stats = new Map<string, { 
      type: string; 
      displayName: string; 
      icon: string; 
      color: string; 
      lightColor: string;
      darkColor: string;
      count: number;
      visible: boolean;
    }>();
    
    // Add vacation stats first
    const vacationDays = this.vacationStats().usedDays;
    const currentYear = this.year();
    if (vacationDays > 0) {
      const vacationType = this.absenceTypes().find(t => t.name === 'vacation');
      stats.set('vacation', {
        type: 'vacation',
        displayName: `Urlaub ${currentYear}`,
        icon: vacationType?.icon || 'sunny',
        color: 'warning',
        lightColor: this.getLightColor(vacationType?.color || '#FFA726'),
        darkColor: vacationType?.color || '#FFA726',
        count: vacationDays,
        visible: this.isAbsenceTypeVisible('vacation')
      });
    }
    
    this.filteredAbsences().forEach(absence => {
      if (absence.absence_type && absence.absence_type.name !== 'vacation' && 
          ['approved', 'hr_processed', 'pending'].includes(absence.status)) {
        const typeName = absence.absence_type.name;
        const days = absence.manual_duration_days || this.calculateWeekdays(absence.start_date!, absence.end_date!);
        
        if (!stats.has(typeName)) {
          stats.set(typeName, {
            type: typeName,
            displayName: absence.absence_type.display_name,
            icon: absence.absence_type.icon || 'calendar',
            color: this.getAbsenceTypeColor(typeName),
            lightColor: this.getLightColor(absence.absence_type.color),
            darkColor: absence.absence_type.color,
            count: 0,
            visible: this.isAbsenceTypeVisible(typeName)
          });
        }
        
        const stat = stats.get(typeName)!;
        stat.count += days;
      }
    });
    
    return Array.from(stats.values()).sort((a, b) => {
      // Urlaub always first
      if (a.type === 'vacation') return -1;
      if (b.type === 'vacation') return 1;
      // Then by count
      return b.count - a.count;
    });
  }

  getLightColor(darkColor: string): string {
    // Convert hex to RGB, lighten it, and convert back
    const hex = darkColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Lighten by blending with white (increase by 60%)
    const lightR = Math.round(r + (255 - r) * 0.6);
    const lightG = Math.round(g + (255 - g) * 0.6);
    const lightB = Math.round(b + (255 - b) * 0.6);
    
    return `#${lightR.toString(16).padStart(2, '0')}${lightG.toString(16).padStart(2, '0')}${lightB.toString(16).padStart(2, '0')}`;
  }

  getAbsenceTypeColor(typeName: string): string {
    const colorMap: { [key: string]: string } = {
      'sick_leave': 'danger',
      'personal_leave': 'tertiary',
      'training': 'secondary',
      'business_trip': 'primary',
      'maternity_leave': 'success',
      'parental_leave': 'success',
      'unpaid_leave': 'medium',
      'public_holiday': 'warning'
    };
    return colorMap[typeName] || 'medium';
  }

  // Vacation details toggle
  showVacationDetails = signal(false);
  
  toggleVacationDetails(): void {
    this.showVacationDetails.update(v => !v);
  }

  // Calendar data generation
  getMonthsData() {
    const months = [];
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const currentYear = this.year();
    
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const firstDay = new Date(currentYear, monthIndex, 1);
      const lastDay = new Date(currentYear, monthIndex + 1, 0);
      
      // Get day of week for first day (0=Sunday, adjust to 1=Monday)
      let startDayOfWeek = firstDay.getDay();
      startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      
      const days: CalendarDay[] = [];
      
      // Add empty cells for days before month starts
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push({
          date: '',
          dayNumber: 0,
          currentMonth: false,
          isToday: false,
          isWeekend: false,
          isHoliday: false,
          absences: []
        });
      }
      
      // Add current month days only
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayDate = new Date(currentYear, monthIndex, day);
        days.push(this.createCalendarDay(dayDate, true));
      }
      
      // Get absence statistics for month header
      const monthAbsences = this.getAbsencesForMonth(monthIndex);
      const absenceStats = this.getMonthAbsenceStats(monthAbsences, monthIndex);
      
      months.push({
        monthIndex,
        name: monthNames[monthIndex],
        days,
        absenceCount: monthAbsences.length,
        absenceIcons: [], // deprecated
        absenceStats
      });
    }
    
    return months;
  }

  createCalendarDay(date: Date, currentMonth: boolean): CalendarDay {
    const today = new Date();
    const dateStr = this.formatDate(date);
    
    return {
      date: dateStr,
      dayNumber: date.getDate(),
      currentMonth,
      isToday: date.toDateString() === today.toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isHoliday: this.isPublicHoliday(date),
      absences: this.getAbsencesForDate(date)
    };
  }

  isPublicHoliday(date: Date): boolean {
    const dateStr = this.formatDate(date);
    return this.holidaysService.isPublicHoliday(date);
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getAbsencesForDate(date: Date): Absence[] {
    const dateStr = this.formatDate(date);
    const visible = this.visibleAbsenceTypes();
    return this.filteredAbsences().filter(absence => {
      if (!absence.start_date || !absence.end_date) return false;
      const typeName = absence.absence_type?.name || 'other';
      const isVisible = visible.has(typeName);
      return dateStr >= absence.start_date && dateStr <= absence.end_date &&
             ['approved', 'hr_processed', 'pending'].includes(absence.status) &&
             isVisible;
    });
  }

  getAbsencesForMonth(monthIndex: number): Absence[] {
    const currentYear = this.year();
    const monthStart = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, monthIndex + 1, 0).getDate();
    const monthEnd = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    return this.filteredAbsences().filter(absence => {
      if (!absence.start_date || !absence.end_date) return false;
      // Include if absence overlaps with month (start <= monthEnd && end >= monthStart)
      return absence.start_date <= monthEnd && absence.end_date >= monthStart &&
             ['approved', 'hr_processed', 'pending'].includes(absence.status);
    });
  }

  getMonthAbsenceStats(absences: Absence[], monthIndex: number): { type: string; icon: string; darkColor: string; days: number }[] {
    const stats = new Map<string, { type: string; icon: string; darkColor: string; days: number }>();
    const visible = this.visibleAbsenceTypes();
    const currentYear = this.year();
    const monthStart = new Date(currentYear, monthIndex, 1);
    const monthEnd = new Date(currentYear, monthIndex + 1, 0);
    
    absences.forEach(absence => {
      const typeName = absence.absence_type?.name || 'other';
      if (!visible.has(typeName)) return; // Skip invisible types
      
      // Calculate days that fall within this specific month
      const absenceStart = new Date(absence.start_date!);
      const absenceEnd = new Date(absence.end_date!);
      const rangeStart = absenceStart > monthStart ? absenceStart : monthStart;
      const rangeEnd = absenceEnd < monthEnd ? absenceEnd : monthEnd;
      
      // For public holidays, count only if they fall on weekdays
      // For other types, count working days (excluding weekends and holidays)
      let days: number;
      if (typeName === 'public_holiday') {
        // For holidays: count 1 if it's a weekday, 0 if weekend
        const dayOfWeek = rangeStart.getDay();
        days = (dayOfWeek !== 0 && dayOfWeek !== 6) ? 1 : 0;
      } else {
        days = this.holidaysService.countWorkingDays(rangeStart, rangeEnd);
      }
      
      if (!stats.has(typeName)) {
        stats.set(typeName, {
          type: typeName,
          icon: absence.absence_type?.icon || this.getIconForType(typeName),
          darkColor: absence.absence_type?.color || '#9E9E9E',
          days: 0
        });
      }
      
      const stat = stats.get(typeName)!;
      stat.days += days;
    });
    
    return Array.from(stats.values()).sort((a, b) => {
      // Sort by type priority: vacation, sick_leave, then others
      if (a.type === 'vacation') return -1;
      if (b.type === 'vacation') return 1;
      if (a.type === 'sick_leave') return -1;
      if (b.type === 'sick_leave') return 1;
      return b.days - a.days;
    });
  }

  getIconForType(typeName: string): string {
    const iconMap: { [key: string]: string } = {
      'vacation': 'sunny',
      'sick_leave': 'medkit',
      'personal_leave': 'person',
      'training': 'school',
      'business_trip': 'airplane',
      'maternity_leave': 'heart',
      'parental_leave': 'home',
      'unpaid_leave': 'time',
      'public_holiday': 'calendar'
    };
    return iconMap[typeName] || 'calendar';
  }

  getUniqueAbsenceIcons(absences: Absence[]): { type: string; icon: string; color: string }[] {
    const types = new Map<string, { type: string; icon: string; color: string }>();
    absences.forEach(absence => {
      const typeName = absence.absence_type?.name || 'other';
      if (!types.has(typeName)) {
        types.set(typeName, {
          type: typeName,
          icon: absence.absence_type?.icon || 'calendar',
          color: this.getAbsenceTypeColor(typeName)
        });
      }
    });
    return Array.from(types.values());
  }

  hasAbsenceType(absences: Absence[], typeName: string): boolean {
    return absences.some(a => a.absence_type?.name === typeName);
  }

  getDayBackgroundColor(day: CalendarDay): string {
    // If has absence, use the color from the first absence type
    if (day.absences.length > 0) {
      const firstAbsence = day.absences[0];
      const color = firstAbsence.absence_type?.color;
      
      // Fallback: if absence type is public_holiday, try to find it in absenceTypes
      if (!color && firstAbsence.absence_type?.name === 'public_holiday') {
        const holidayType = this.absenceTypes().find(t => t.name === 'public_holiday');
        return holidayType?.color || '#42A5F5';
      }
      
      return color || '#9E9E9E';
    }
    
    // If today and no absence, use primary color
    if (day.isToday) {
      return 'var(--ion-color-primary)';
    }
    
    // If public holiday (no absence but is holiday marked by system)
    if (day.isHoliday) {
      // Get public_holiday type color
      const holidayType = this.absenceTypes().find(t => t.name === 'public_holiday');
      return holidayType?.color || '#42A5F5';
    }
    
    // Default: transparent
    return 'transparent';
  }

  // Day click handler
  showDetailModal = signal(false);

  onDayClick(day: CalendarDay): void {
    if (day.absences.length === 1) {
      this.selectedAbsence.set(day.absences[0]);
      this.showDetailModal.set(true);
    } else if (day.absences.length > 1) {
      // TODO: Show list modal for multiple absences
    }
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedAbsence.set(null);
  }

  // Communication methods
  toggleAbsenceDetails(absenceId: number): void {
    const expanded = this.expandedAbsences();
    const newExpanded = new Set(expanded);
    
    if (newExpanded.has(absenceId)) {
      newExpanded.delete(absenceId);
    } else {
      newExpanded.add(absenceId);
      this.loadAbsenceComments(absenceId);
    }
    
    this.expandedAbsences.set(newExpanded);
  }

  isAbsenceExpanded(absenceId: number): boolean {
    return this.expandedAbsences().has(absenceId);
  }

  loadAbsenceComments(absenceId: number): void {
    // Comments are already loaded with the absence, so we just extract them
    const absence = this.absences().find(a => a.id === absenceId);
    if (absence && absence.comments) {
      const commentsMap = this.absenceComments();
      commentsMap.set(absenceId, absence.comments);
      this.absenceComments.set(new Map(commentsMap));
    }
  }

  getAbsenceComments(absenceId: number): AbsenceComment[] {
    return this.absenceComments().get(absenceId) || [];
  }

  getVisibleComments(absenceId: number): AbsenceComment[] {
    return this.getAbsenceComments(absenceId).filter(comment => !comment.is_internal);
  }

  initQuickCommentForm(absenceId: number): void {
    const forms = this.quickCommentForms();
    if (!forms.has(absenceId)) {
      forms.set(absenceId, {
        comment: '',
        type: 'employee',
        isInternal: false
      });
      this.quickCommentForms.set(new Map(forms));
    }
  }

  updateQuickComment(absenceId: number, field: string, value: any): void {
    const forms = this.quickCommentForms();
    const form = forms.get(absenceId);
    if (form) {
      (form as any)[field] = value;
      forms.set(absenceId, { ...form });
      this.quickCommentForms.set(new Map(forms));
    }
  }

  getQuickCommentForm(absenceId: number) {
    return this.quickCommentForms().get(absenceId) || {
      comment: '',
      type: 'employee' as const,
      isInternal: false
    };
  }

  addQuickComment(absenceId: number): void {
    const form = this.getQuickCommentForm(absenceId);
    if (!form.comment.trim()) return;

    const submitting = this.submittingComments();
    submitting.add(absenceId);
    this.submittingComments.set(new Set(submitting));

    const commentRequest: CommentRequest = {
      content: form.comment,
      comment_type: form.type,
      is_internal: form.isInternal
    };

    this.service.addComment(absenceId, commentRequest).subscribe({
      next: (comment: AbsenceComment) => {
        // Add comment to local state
        const commentsMap = this.absenceComments();
        const existingComments = commentsMap.get(absenceId) || [];
        commentsMap.set(absenceId, [...existingComments, comment]);
        this.absenceComments.set(new Map(commentsMap));

        // Reset form
        const forms = this.quickCommentForms();
        forms.set(absenceId, {
          comment: '',
          type: 'employee',
          isInternal: false
        });
        this.quickCommentForms.set(new Map(forms));

        // Remove from submitting
        const newSubmitting = this.submittingComments();
        newSubmitting.delete(absenceId);
        this.submittingComments.set(new Set(newSubmitting));
      },
      error: (err: any) => {
        console.error('Error adding comment:', err);
        const newSubmitting = this.submittingComments();
        newSubmitting.delete(absenceId);
        this.submittingComments.set(new Set(newSubmitting));
      }
    });
  }

  isSubmittingComment(absenceId: number): boolean {
    return this.submittingComments().has(absenceId);
  }

  getCommentTypeLabel(type: string): string {
    const typeMap: { [key: string]: string } = {
      'employee': 'Mitarbeiter',
      'supervisor': 'Vorgesetzter',
      'hr': 'HR'
    };
    return typeMap[type] || type;
  }

  getCommentTypeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      'employee': 'primary',
      'supervisor': 'secondary',
      'hr': 'tertiary'
    };
    return colorMap[type] || 'medium';
  }

  formatCommentDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  viewAbsenceDetails(absenceId: number): void {
    this.router.navigate(['/apps/absences', absenceId]);
  }

  canEditAbsence(absence: any): boolean {
    return absence.status === 'pending' || absence.status === 'approved';
  }

  canAddComment(absence: any): boolean {
    return true; // Allow comments on all absences
  }

  getRecentComments(absenceId: number, limit: number = 2): AbsenceComment[] {
    const comments = this.getAbsenceComments(absenceId);
    return comments.slice(-limit);
  }

  hasMoreComments(absenceId: number, displayLimit: number = 2): boolean {
    const comments = this.getAbsenceComments(absenceId);
    return comments.length > displayLimit;
  }

  getAbsenceProgress(absence: any): number {
    const statusProgress: { [key: string]: number } = {
      'pending': 25,
      'approved': 75,
      'hr_notified': 100,
      'rejected': 0,
      'cancelled': 0
    };
    return statusProgress[absence.status] || 0;
  }

  getAbsenceProgressColor(absence: any): string {
    const progress = this.getAbsenceProgress(absence);
    if (progress === 0) return 'danger';
    if (progress < 50) return 'warning';
    if (progress < 100) return 'secondary';
    return 'success';
  }

  // Missing methods from template
  viewFullDetails(absenceId: number): void {
    this.router.navigate(['/apps/absences', absenceId]);
  }

  getLastComments(comments: AbsenceComment[] | undefined, limit: number): AbsenceComment[] {
    if (!comments) return [];
    return comments.slice(-limit);
  }

  getCommentAuthorIcon(commentType: string): string {
    const iconMap: { [key: string]: string } = {
      'user_comment': 'person',
      'supervisor_feedback': 'business',
      'hr_note': 'people',
      'revision_request': 'create',
      'approval_note': 'checkmark-circle',
      'rejection_note': 'close-circle'
    };
    return iconMap[commentType] || 'chatbox';
  }

  viewAllComments(absenceId: number): void {
    this.router.navigate(['/apps/absences', absenceId, 'comments']);
  }

  submitQuickComment(absenceId: number): void {
    this.addQuickComment(absenceId);
    this.showQuickCommentForm.set(null);
  }

  cancelQuickComment(): void {
    this.showQuickCommentForm.set(null);
  }

  // Fixed method signatures (remove $event parameter)
  addQuickCommentFixed(absenceId: number): void {
    this.showQuickCommentForm.set(absenceId);
    this.initQuickCommentForm(absenceId);
  }

  /**
   * Calculate weekdays (Monday to Friday) between two dates
   */
  calculateWeekdays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Monday = 1, Tuesday = 2, ..., Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Get weekday count for display (replaces duration_days)
   */
  getWeekdayDuration(absence: Absence): number {
    // Verwende manuelle manual_duration_days falls vorhanden, sonst automatische Berechnung
    return absence.manual_duration_days || this.calculateWeekdays(absence.start_date!, absence.end_date!);
  }

  /**
   * Get formatted duration text for absence
   */
  getDurationText(absence: Absence): string {
    const days = this.getWeekdayDuration(absence);
    return `${days} ${days === 1 ? 'Werktag' : 'Werktage'}`;
  }

  viewFullDetailsFixed(absenceId: number): void {
    this.viewFullDetails(absenceId);
  }

  viewAllCommentsFixed(absenceId: number): void {
    this.viewAllComments(absenceId);
  }

  // Modal methods
  openAbsenceModal(absence: Absence): void {
    this.selectedAbsence.set(absence);
    this.isModalOpen.set(true);
  }

  closeAbsenceModal(): void {
    this.isModalOpen.set(false);
    this.selectedAbsence.set(null);
  }

  // Filter methods
  setFilter(filter: 'all' | 'pending' | 'approved'): void {
    this.selectedFilter.set(filter);
  }

  getFilteredByStatus(): Absence[] {
    const filter = this.selectedFilter();
    const absences = this.filteredAbsences();
    
    if (filter === 'all') return absences;
    if (filter === 'pending') return absences.filter(a => a.status === 'pending');
    if (filter === 'approved') return absences.filter(a => ['approved', 'hr_processed'].includes(a.status));
    
    return absences;
  }

  getPendingCount(): number {
    return this.filteredAbsences().filter(a => a.status === 'pending').length;
  }

  getApprovedCount(): number {
    return this.filteredAbsences().filter(a => ['approved', 'hr_processed'].includes(a.status)).length;
  }

  // Expand/collapse cards
  toggleExpand(absenceId: number): void {
    const expanded = this.expandedCards();
    if (expanded.has(absenceId)) {
      expanded.delete(absenceId);
    } else {
      expanded.add(absenceId);
    }
    this.expandedCards.set(new Set(expanded));
  }

  isExpanded(absenceId: number): boolean {
    return this.expandedCards().has(absenceId);
  }

  // Create absence modal
  openCreateModal(): void {
    this.showCreateModal.set(true);
  }
  
  async openHRAssignmentModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: HRAssignmentModalComponent,
      cssClass: 'hr-assignment-modal'
    });
    await modal.present();
  }
  
  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.editingAbsence.set(null);
  }

  editAbsence(absence: Absence): void {
    this.editingAbsence.set(absence);
    this.showCreateModal.set(true);
  }

  onAbsenceCreated(): void {
    this.service.loadMyAbsences();
    this.showCreateModal.set(false);
  }

  // Delete absence
  // Delete absence
  async deleteAbsence(absenceId: number): Promise<void> {
    const confirmed = await this.confirmDelete();
    if (!confirmed) return;

    this.service.deleteAbsence(absenceId).subscribe({
      next: () => {
        this.service.loadMyAbsences();
      },
      error: (err: any) => {
        console.error('Error deleting absence:', err);
      }
    });
  }

  private async confirmDelete(): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Abwesenheit zurückziehen',
      message: 'Möchten Sie diese Abwesenheit wirklich zurückziehen?',
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Zurückziehen',
          role: 'destructive'
        }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role !== 'cancel';
  }

  // Utility methods for template
  getAbsenceIcon(absence: Absence): string {
    if (!absence.absence_type) {
      return absence.reason === 'Urlaub' ? 'sunny' : 'medkit';
    }
    
    const iconMap: { [key: string]: string } = {
      'vacation': 'sunny',
      'sick_leave': 'medkit',
      'personal_leave': 'person',
      'training': 'school',
      'business_trip': 'airplane',
      'maternity_leave': 'heart',
      'parental_leave': 'home',
      'unpaid_leave': 'time'
    };
    
    return iconMap[absence.absence_type.name] || 'calendar';
  }

  getAbsenceIconColor(absence: Absence): string {
    if (!absence.absence_type) {
      return absence.reason === 'Urlaub' ? 'warning' : 'danger';
    }
    return this.service.getStatusColor(absence.absence_type.name);
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'pending': 'time',
      'approved': 'checkmark-circle',
      'rejected': 'close-circle',
      'hr_notified': 'checkmark-done',
      'cancelled': 'ban'
    };
    
    return iconMap[status] || 'help-circle';
  }

  getStatusColor(status: string): string {
    return this.service.getStatusColor(status);
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ausstehend',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'hr_notified': 'HR Benachrichtigt',
      'cancelled': 'Storniert'
    };
    
    return statusMap[status] || status;
  }
}

