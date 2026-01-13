import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { 
  IonIcon, 
  IonBadge, 
  IonAvatar, 
  IonChip, 
  IonButton, 
  IonSegment, 
  IonSegmentButton, 
  IonLabel, 
  IonItem, 
  IonCheckbox, 
  IonTextarea, 
  IonCard, 
  IonCardContent 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  chatbubbles, 
  chatbubblesOutline, 
  person, 
  star, 
  business, 
  eyeOff, 
  chatbox, 
  send, 
  informationCircle 
} from 'ionicons/icons';

import { AbsenceService } from '../../core/services/absence.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { AbsenceComment, CommentRequest } from '../../core/interfaces/absence.types';

@Component({
  selector: 'app-absence-comments',
  templateUrl: './absence-comments.component.html',
  styleUrls: ['./absence-comments.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonIcon,
    IonBadge,
    IonAvatar,
    IonChip,
    IonButton,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonItem,
    IonCheckbox,
    IonTextarea,
    IonCard,
    IonCardContent
  ]
})
export class AbsenceCommentsComponent implements OnInit {
  @Input({ required: true }) absenceId!: number;
  @Input() comments = signal<AbsenceComment[]>([]);

  // State
  isSubmitting = signal(false);
  commentForm: FormGroup;

  // Computed properties
  currentUser = this.authService.activeUser;
  
  constructor(
    private fb: FormBuilder,
    private absenceService: AbsenceService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    // Register icons
    addIcons({
      chatbubbles,
      chatbubblesOutline,
      person,
      star,
      business,
      eyeOff,
      chatbox,
      send,
      informationCircle
    });

    // Initialize form
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
      comment_type: ['user_comment'],
      is_internal: [false]
    });
  }

  ngOnInit() {
    this.loadComments();
  }

  /**
   * Load comments for the absence
   */
  private loadComments() {
    // Comments are already loaded via the absence details
    // This component receives them via @Input()
  }

  /**
   * Track function for comment list
   */
  trackByCommentId(index: number, comment: AbsenceComment): number {
    return comment.id;
  }

  /**
   * Check if comment belongs to current user
   */
  isOwnComment(comment: AbsenceComment): boolean {
    const currentUser = this.currentUser();
    return currentUser?.id === comment.author.id;
  }

  /**
   * Get icon for comment author type
   */
  getAuthorIcon(commentType: string): string {
    switch (commentType) {
      case 'supervisor_note':
        return 'star';
      case 'hr_note':
        return 'business';
      default:
        return 'person';
    }
  }

  /**
   * Get color for comment type chip
   */
  getCommentTypeColor(commentType: string): string {
    switch (commentType) {
      case 'supervisor_note':
        return 'warning';
      case 'hr_note':
        return 'tertiary';
      default:
        return 'primary';
    }
  }

  /**
   * Get label for comment type
   */
  getCommentTypeLabel(commentType: string): string {
    const labels: { [key: string]: string } = {
      'user_comment': 'Mitarbeiter',
      'supervisor_note': 'Vorgesetzter',
      'hr_note': 'HR',
      'system_note': 'System'
    };
    return labels[commentType] || 'Unbekannt';
  }

  /**
   * Check if user can add comments
   */
  canAddComment(): boolean {
    const user = this.currentUser();
    if (!user) return false;

    // User can comment on their own absences
    // Supervisors and HR can comment on any absence
    // TODO: Add more specific permission logic based on absence ownership
    return user.is_staff || user.is_supervisor || true; // Simplified for now
  }

  /**
   * Check if user can reply to specific comment
   */
  canReplyToComment(comment: AbsenceComment): boolean {
    // For now, just check if user can add comments in general
    return this.canAddComment();
  }

  /**
   * Check if comment type selection should be shown
   */
  showCommentTypeSelection(): boolean {
    const user = this.currentUser();
    return user?.is_staff || user?.is_supervisor || false;
  }

  /**
   * Check if user can create supervisor notes
   */
  canCreateSupervisorNote(): boolean {
    const user = this.currentUser();
    return user?.is_supervisor || false;
  }

  /**
   * Check if user can create HR notes
   */
  canCreateHRNote(): boolean {
    const user = this.currentUser();
    return user?.is_staff || false;
  }

  /**
   * Check if user can create internal comments
   */
  canCreateInternalComment(): boolean {
    const user = this.currentUser();
    return user?.is_staff || user?.is_supervisor || false;
  }

  /**
   * Reply to a specific comment
   */
  replyToComment(comment: AbsenceComment) {
    // Pre-fill the comment field with a mention
    const currentContent = this.commentForm.get('content')?.value || '';
    const replyText = `@${comment.author_name}: `;
    this.commentForm.patchValue({
      content: currentContent + replyText
    });

    // Focus the textarea
    setTimeout(() => {
      const textarea = document.querySelector('ion-textarea textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 100);
  }

  /**
   * Submit new comment
   */
  async submitComment() {
    if (this.commentForm.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      const formValue = this.commentForm.value;
      const commentRequest: CommentRequest = {
        content: formValue.content.trim(),
        comment_type: formValue.comment_type,
        is_internal: formValue.is_internal
      };

      await this.absenceService.addComment(this.absenceId, commentRequest).toPromise();

      // Reset form
      this.commentForm.reset({
        content: '',
        comment_type: 'user_comment',
        is_internal: false
      });

      // Show success message
      this.notificationService.notifySuccess('Kommentar erfolgreich hinzugefügt');

      // Reload comments will happen automatically via the service

    } catch (error) {
      console.error('Error adding comment:', error);
      this.notificationService.notifyError('Fehler beim Hinzufügen des Kommentars');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
