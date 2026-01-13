import { Component, Input, Output, EventEmitter, inject, signal, computed, OnChanges, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon,
  IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea,
  IonFooter, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, calendarOutline, documentTextOutline, timeOutline, checkmarkCircle, personOutline } from 'ionicons/icons';
import { AbsenceService } from 'src/app/core/services/absence.service';
import { PublicHolidaysService } from 'src/app/core/services/public-holidays.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { AbsenceCreateRequest, Absence } from 'src/app/core/interfaces/absence.types';
import { environment } from 'src/environments/environment';
import { tap, catchError, of } from 'rxjs';

@Component({
  selector: 'app-absence-create-modal',
  templateUrl: './absence-create-modal.component.html',
  styleUrls: ['./absence-create-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon,
    IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea,
    IonFooter, IonSpinner
  ]
})
export class AbsenceCreateModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() editingAbsence: Absence | null = null;
  @Output() didDismiss = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private absenceService = inject(AbsenceService);
  private holidaysService = inject(PublicHolidaysService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  absenceTypes = this.absenceService.absenceTypes;
  availableRepresentatives = signal<any[]>([]);
  isSubmitting = signal(false);

  constructor() {
    addIcons({ close, calendarOutline, documentTextOutline, timeOutline, checkmarkCircle, personOutline });
    
    // Load representatives when component initializes
    this.loadRepresentatives();
    
    // Watch for date changes
    this.createForm.valueChanges.subscribe(() => {
      this.updateWorkingDays();
    });
  }

  private loadRepresentatives(): void {
    const currentUser = this.authService.activeUser();
    console.log('loadRepresentatives called, currentUser:', currentUser);
    
    if (!currentUser) {
      console.warn('No current user found, skipping representatives load');
      return;
    }

    console.log('Fetching contacts from:', `${environment.apiUrl}/contacts/`);
    
    this.http.get<any[]>(`${environment.apiUrl}/contacts/`)
      .pipe(
        tap((contacts) => {
          console.log('All contacts from API:', contacts);
          console.log('First contact structure:', JSON.stringify(contacts[0], null, 2));
          console.log('Current user:', currentUser);
          console.log('Current user department:', currentUser.department);
          console.log('Current user role:', currentUser.role);
          
          // Super users (role 1 = admin, role 2 = hr) can see all
          const isSuperUser = currentUser.role === 1 || currentUser.role === 2;
          
          let filtered = contacts;
          if (!isSuperUser && currentUser.department) {
            // Regular users: filter by department
            filtered = contacts.filter(c => 
              c.department_id === currentUser.department && 
              c.user_id !== currentUser.id
            );
          } else {
            // Super users or users without department: see all except self
            filtered = contacts.filter(c => c.user_id !== currentUser.id);
          }
          
          this.availableRepresentatives.set(filtered);
          console.log('Filtered representatives:', filtered);
        }),
        catchError((err) => {
          console.error('Error loading representatives:', err);
          return of([]);
        })
      )
      .subscribe();
  }

  createForm = this.fb.group({
    absence_type_id: [1, Validators.required],
    start_date: [this.formatDateForInput(new Date()), Validators.required],
    end_date: [this.formatDateForInput(new Date()), Validators.required],
    reason: [''],
    representative_id: [null as number | null]
  });

  workingDays = signal(1);

  ngOnChanges(): void {
    if (this.isOpen) {
      // Load representatives when modal opens
      this.loadRepresentatives();
    }
    
    if (this.editingAbsence) {
      this.createForm.patchValue({
        absence_type_id: this.editingAbsence.absence_type_id || this.editingAbsence.absence_type?.id,
        start_date: this.editingAbsence.start_date,
        end_date: this.editingAbsence.end_date,
        reason: this.editingAbsence.reason || '',
        representative_id: this.editingAbsence.representative_id || null
      });
      this.updateWorkingDays();
    }
  }

  private updateWorkingDays(): void {
    const startStr = this.createForm.value.start_date;
    const endStr = this.createForm.value.end_date;
    
    if (!startStr || !endStr) {
      this.workingDays.set(0);
      return;
    }
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    this.workingDays.set(this.holidaysService.countWorkingDays(start, end));
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  closeModal(): void {
    this.didDismiss.emit();
    this.createForm.reset({
      absence_type_id: 1,
      start_date: this.formatDateForInput(new Date()),
      end_date: this.formatDateForInput(new Date()),
      reason: '',
      representative_id: null
    });
  }

  submit(): void {
    if (this.createForm.invalid) return;

    this.isSubmitting.set(true);
    const values = this.createForm.value;

    const payload: AbsenceCreateRequest = {
      absence_type_id: Number(values.absence_type_id) || 1,
      start_date: values.start_date!,
      end_date: values.end_date!,
      manual_duration_days: this.workingDays(),
      reason: values.reason || undefined,
      representative_id: values.representative_id || undefined
    };

    // Edit or Create
    const action$ = this.editingAbsence 
      ? this.absenceService.updateAbsence(this.editingAbsence.id!, payload)
      : this.absenceService.createAbsence(payload);

    action$.subscribe({
      next: (result) => {
        if (result) {
          this.created.emit();
          this.closeModal();
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        console.error('Error saving absence:', err);
        this.isSubmitting.set(false);
      }
    });
  }
}
