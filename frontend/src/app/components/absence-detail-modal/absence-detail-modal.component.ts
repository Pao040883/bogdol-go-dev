import { Component, Input, OnInit, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonItem, IonLabel,
  IonModal, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonBadge, IonChip, IonTextarea, IonSelect, IonSelectOption,
  IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonFooter,
  IonDatetime, IonInput, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close, person, calendar, time, checkmarkCircle, closeCircle,
  chatbubbles, send, eye, eyeOff, business, people, shieldCheckmark,
  chevronDown, chevronUp, star, heart, add, arrowForward, informationCircle,
  chatbubblesOutline, trash, create } from 'ionicons/icons';
import { AbsenceService } from 'src/app/core/services/absence.service';
import { Absence, AbsenceComment, CommentRequest } from 'src/app/core/interfaces/absence.types';

@Component({
  selector: 'app-absence-detail-modal',
  templateUrl: './absence-detail-modal.component.html',
  styleUrls: ['./absence-detail-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonItem, IonLabel,
    IonModal, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonBadge, IonChip, IonTextarea, IonSelect, IonSelectOption,
    IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonFooter,
    IonDatetime, IonInput
  ],
})
export class AbsenceDetailModalComponent implements OnInit {
  @Input() absence: Absence | null = null;
  @Input() isOpen = false;
  @Output() didDismiss = new EventEmitter<void>();

  readonly absenceService = inject(AbsenceService);
  private readonly fb = inject(FormBuilder);
  private readonly alertController = inject(AlertController);

  // Signals
  comments = signal<AbsenceComment[]>([]);
  isLoading = signal(false);
  isSubmittingComment = signal(false);
  commentFilter = signal<string>('all');
  isEditing = signal(false); // Neuer Signal für Bearbeitungsmodus

  // Forms
  commentForm: FormGroup;
  editForm: FormGroup; // Neues Formular für Bearbeitung

  // Computed
  filteredComments = computed(() => {
    const filter = this.commentFilter();
    const allComments = this.comments();
    
    if (filter === 'all') {
      return allComments;
    }
    
    return allComments.filter(comment => comment.comment_type === filter);
  });

  constructor() {
    addIcons({close,calendar,arrowForward,informationCircle,chatbubbles,send,chatbubblesOutline,create,trash,person,time,checkmarkCircle,closeCircle,eye,eyeOff,business,people,shieldCheckmark,chevronDown,chevronUp,star,heart,add});

    this.commentForm = this.fb.group({
      comment: ['', [Validators.required, Validators.minLength(3)]],
      type: ['employee', Validators.required],
      is_internal: [false]
    });

    this.editForm = this.fb.group({
      absence_type_id: [1, Validators.required],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      duration_days: [1, [Validators.required, Validators.min(1)]],
      reason: ['']
    });
  }

  ngOnInit() {
    if (this.absence?.id) {
      this.loadComments();
    }
  }

  async loadComments() {
    if (!this.absence?.id) return;
    
    this.isLoading.set(true);
    try {
      const comments = await this.absenceService.getComments(this.absence.id).toPromise();
      this.comments.set(comments || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitComment() {
    if (this.commentForm.invalid || !this.absence?.id) return;

    this.isSubmittingComment.set(true);
    try {
      const commentData: CommentRequest = {
        content: this.commentForm.value.comment,
        comment_type: this.commentForm.value.type,
        is_internal: this.commentForm.value.is_internal
      };

      const newComment = await this.absenceService.addComment(this.absence.id, commentData).toPromise();
      
      // Add new comment to the list
      if (newComment) {
        this.comments.update(comments => [...comments, newComment]);
      }
      
      // Reset form
      this.commentForm.reset({
        comment: '',
        type: 'employee',
        is_internal: false
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      this.isSubmittingComment.set(false);
    }
  }

  filterComments(event: any) {
    this.commentFilter.set(event.detail.value);
  }

  closeModal() {
    // Reset component state
    this.comments.set([]);
    this.commentFilter.set('all');
    this.commentForm.reset({
      comment: '',
      type: 'employee',
      is_internal: false
    });
    
    // Emit event to parent
    this.didDismiss.emit();
  }

  async refresh(event: any) {
    await this.loadComments();
    event.target.complete();
  }

  // Helper methods
  getAbsenceIcon(): string {
    if (!this.absence?.absence_type) return 'calendar';
    
    const iconMap: { [key: string]: string } = {
      'Urlaub': 'sunny',
      'Krank': 'medkit',
      'Fortbildung': 'school',
      'Dienstreise': 'airplane',
      'Sonderurlaub': 'heart',
      'Gleitzeit': 'time',
      'Homeoffice': 'home'
    };
    
    return iconMap[this.absence.absence_type?.display_name || ''] || 'calendar';
  }

  getStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'pending': 'warning',
      'approved': 'success',
      'rejected': 'danger',
      'cancelled': 'medium',
      'completed': 'success'
    };
    return colorMap[status] || 'medium';
  }

  getStatusText(status: string): string {
    const textMap: { [key: string]: string } = {
      'pending': 'Ausstehend',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'cancelled': 'Storniert',
      'completed': 'Abgeschlossen'
    };
    return textMap[status] || status;
  }

  getCommentTypeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      'employee': 'success',
      'supervisor': 'warning',
      'hr': 'danger'
    };
    return colorMap[type] || 'primary';
  }

  getCommentTypeLabel(type: string): string {
    const labelMap: { [key: string]: string } = {
      'employee': 'Mitarbeiter',
      'supervisor': 'Vorgesetzter',
      'hr': 'HR'
    };
    return labelMap[type] || type;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getDurationText(): string {
    if (!this.absence?.duration_days) return '';
    const days = this.absence.duration_days;
    return `${days} ${days === 1 ? 'Tag' : 'Tage'}`;
  }

  /** Prüfe ob Abwesenheit gelöscht werden kann */
  canDelete(): boolean {
    if (!this.absence) return false;
    // Nur eigene Abwesenheiten mit Status pending können gelöscht werden
    return this.absence.status === 'pending';
  }

  /** Prüfe ob Abwesenheit bearbeitet werden kann */
  canEdit(): boolean {
    if (!this.absence) return false;
    // Nur eigene Abwesenheiten mit Status pending können bearbeitet werden
    return this.absence.status === 'pending';
  }

  /** Aktiviere Bearbeitungsmodus */
  startEdit(): void {
    if (!this.absence || !this.canEdit()) return;

    this.editForm.patchValue({
      absence_type_id: this.absence.absence_type_id || this.absence.absence_type?.id || 1,
      start_date: this.absence.start_date,
      end_date: this.absence.end_date,
      duration_days: this.absence.manual_duration_days || 1,
      reason: this.absence.reason || ''
    });

    this.isEditing.set(true);
  }

  /** Brich Bearbeitung ab */
  cancelEdit(): void {
    this.isEditing.set(false);
    this.editForm.reset();
  }

  /** Speichere Änderungen */
  async saveEdit(): Promise<void> {
    if (!this.absence || !this.absence.id || this.editForm.invalid) return;

    const values = this.editForm.value;
    const updateData = {
      absence_type_id: Number(values.absence_type_id),
      start_date: values.start_date,
      end_date: values.end_date,
      manual_duration_days: Number(values.duration_days),
      reason: values.reason || undefined
    };

    this.absenceService.updateAbsence(this.absence.id, updateData).subscribe({
      next: (updated) => {
        if (updated) {
          this.absence = updated;
          this.isEditing.set(false);
        }
      }
    });
  }

  /** Lösche Abwesenheit */
  async deleteAbsence(): Promise<void> {
    if (!this.absence || !this.absence.id || !this.canDelete()) return;

    // Bestätigungsdialog
    const confirmed = await this.showConfirmDialog(
      'Abwesenheit löschen',
      'Möchten Sie diese Abwesenheit wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
    );

    if (confirmed) {
      this.absenceService.deleteAbsence(this.absence.id).subscribe({
        next: (success) => {
          if (success) {
            this.closeModal();
          }
        }
      });
    }
  }

  /** Zeige Bestätigungsdialog */
  private async showConfirmDialog(header: string, message: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Bestätigen',
          role: 'destructive'
        }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role !== 'cancel';
  }
}
