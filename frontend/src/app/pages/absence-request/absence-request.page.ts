import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
  IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonButton, IonIcon, IonNote, IonBadge, IonList, IonProgressBar,
  IonAlert, IonChip
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline, personOutline, alertCircleOutline,
  checkmarkCircleOutline, documentAttachOutline, informationCircleOutline
} from 'ionicons/icons';
import { AbsenceService } from '../../core/services/absence.service';
import { NotificationService } from '../../core/services/notification.service';
import { AbsenceType, AbsenceCreateRequest, User } from '../../core/interfaces/absence.types';
import { UserPhonebookService } from '../../core/services/user-phonebook.service';

@Component({
  selector: 'app-absence-request',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
    IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonButton, IonIcon, IonNote, IonBadge, IonProgressBar,
    IonAlert
  ],
  templateUrl: './absence-request.page.html',
  styleUrls: ['./absence-request.page.scss']
})
export class AbsenceRequestPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly absenceService = inject(AbsenceService);
  readonly notificationService = inject(NotificationService);
  readonly phonebookService = inject(UserPhonebookService);

  absenceForm!: FormGroup;
  isSubmitting = signal(false);
  showOverlapWarning = signal(false);
  showVacationWarning = signal(false);
  showConfirmAlert = signal(false);

  // Computed
  selectedAbsenceType = computed(() => {
    const typeId = this.absenceForm?.get('absence_type_id')?.value;
    if (!typeId) return null;
    return this.absenceService.getAbsenceType(typeId);
  });

  isVacationType = computed(() => {
    const type = this.selectedAbsenceType();
    return type?.name === 'vacation';
  });

  calculatedDuration = computed(() => {
    const start = this.absenceForm?.get('start_date')?.value;
    const end = this.absenceForm?.get('end_date')?.value;
    
    if (!start || !end) return 0;
    
    return this.absenceService.calculateWorkingDays(start, end);
  });

  vacationSummary = signal<{
    total_entitlement: number;
    used_vacation_days: number;
    remaining_vacation_days: number;
    vacation_year?: number;
  } | null>(null);

  currentYear = new Date().getFullYear();

  overlapCheck = computed(() => {
    const start = this.absenceForm?.get('start_date')?.value;
    const end = this.absenceForm?.get('end_date')?.value;
    
    if (!start || !end) return { hasOverlap: false, overlappingAbsences: [] };
    
    return this.absenceService.checkOverlap(start, end);
  });

  availableUsers = computed(() => {
    return this.phonebookService.entries().filter((user: any) => !user.is_absent);
  });

  alertButtons = [
    {
      text: 'Abbrechen',
      role: 'cancel',
      handler: () => {
        this.cancelSubmit();
      }
    },
    {
      text: 'Ja, einreichen',
      role: 'confirm',
      handler: () => {
        this.confirmSubmitWithWarnings();
      }
    }
  ];

  constructor() {
    addIcons({ 
      calendarOutline, 
      informationCircleOutline, 
      alertCircleOutline, 
      checkmarkCircleOutline, 
      personOutline, 
      documentAttachOutline 
    });
  }

  ngOnInit() {
    this.initForm();
    this.loadVacationSummary();
    this.phonebookService.loadPhonebook();
    
    // Überwache Datumsänderungen
    this.absenceForm.get('start_date')?.valueChanges.subscribe(() => this.validateDates());
    this.absenceForm.get('end_date')?.valueChanges.subscribe(() => this.validateDates());
    this.absenceForm.get('absence_type_id')?.valueChanges.subscribe(() => this.onTypeChange());
  }

  initForm() {
    this.absenceForm = this.fb.group({
      absence_type_id: [null, Validators.required],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      reason: [''],
      representative_id: [null],
      manual_duration_days: [null]
    });
  }

  loadVacationSummary() {
    this.absenceService.loadVacationSummary().subscribe((summary: any) => {
      this.vacationSummary.set(summary);
    });
  }

  onTypeChange() {
    const type = this.selectedAbsenceType();
    
    // Setze Validatoren basierend auf Typ
    if (type?.requires_certificate) {
      // Hier könnte man File-Upload Required machen
    }
    
    if (type?.requires_approval) {
      this.absenceForm.get('representative_id')?.setValidators(Validators.required);
    } else {
      this.absenceForm.get('representative_id')?.clearValidators();
    }
    
    this.absenceForm.get('representative_id')?.updateValueAndValidity();
  }

  validateDates() {
    const overlap = this.overlapCheck();
    this.showOverlapWarning.set(overlap.hasOverlap);
    
    // Urlaubsanspruch prüfen
    if (this.isVacationType()) {
      const duration = this.calculatedDuration();
      const summary = this.vacationSummary();
      
      if (summary && duration > summary.remaining_vacation_days) {
        this.showVacationWarning.set(true);
      } else {
        this.showVacationWarning.set(false);
      }
    }
  }

  async onSubmit() {
    if (this.absenceForm.invalid) {
      this.notificationService.notifyError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    // Warnungen prüfen
    if (this.showOverlapWarning() || this.showVacationWarning()) {
      this.showConfirmAlert.set(true);
      return;
    }

    await this.submitRequest();
  }

  async submitRequest() {
    this.isSubmitting.set(true);
    
    const formValue = this.absenceForm.value;
    const request: AbsenceCreateRequest = {
      absence_type_id: formValue.absence_type_id,
      start_date: formValue.start_date,
      end_date: formValue.end_date,
      reason: formValue.reason || undefined,
      representative_id: formValue.representative_id || undefined,
      manual_duration_days: formValue.manual_duration_days || undefined
    };

    this.absenceService.createAbsence(request).subscribe({
      next: (absence: any) => {
        if (absence) {
          this.notificationService.notifySuccess('Abwesenheitsantrag erfolgreich erstellt');
          this.router.navigate(['/apps/absences/my-absences']);
        }
      },
      error: (err: any) => {
        console.error('Error creating absence:', err);
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  confirmSubmitWithWarnings() {
    this.showConfirmAlert.set(false);
    this.submitRequest();
  }

  cancelSubmit() {
    this.showConfirmAlert.set(false);
  }

  getUserDisplayName(user: any): string {
    return `${user.first_name} ${user.last_name}`.trim() || user.email || `User ${user.id}`;
  }

  getMinDate(): string {
    const type = this.selectedAbsenceType();
    if (!type || type.advance_notice_days === 0) {
      return new Date().toISOString().split('T')[0];
    }
    
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + type.advance_notice_days);
    return minDate.toISOString().split('T')[0];
  }
}
