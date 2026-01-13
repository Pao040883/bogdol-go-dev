import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { AbsenceCommentsComponent } from './absence-comments.component';
import { AbsenceService } from '../../core/services/absence.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { AbsenceComment } from '../../core/interfaces/absence.types';
import { Users } from '../../core/interfaces/users';

describe('AbsenceCommentsComponent', () => {
  let component: AbsenceCommentsComponent;
  let fixture: ComponentFixture<AbsenceCommentsComponent>;
  let mockAbsenceService: jasmine.SpyObj<AbsenceService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;

  const mockUser: Users = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
    is_staff: false,
    is_supervisor: true
  };

  const mockComments: AbsenceComment[] = [
    {
      id: 1,
      absence: 1,
      author: mockUser,
      author_name: 'Test User',
      content: 'Test comment',
      comment_type: 'user_comment',
      is_internal: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    const absenceServiceSpy = jasmine.createSpyObj('AbsenceService', ['addComment']);
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['activeUser']);
    const notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['notifySuccess', 'notifyError']);

    await TestBed.configureTestingModule({
      imports: [AbsenceCommentsComponent, ReactiveFormsModule],
      providers: [
        FormBuilder,
        { provide: AbsenceService, useValue: absenceServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AbsenceCommentsComponent);
    component = fixture.componentInstance;
    mockAbsenceService = TestBed.inject(AbsenceService) as jasmine.SpyObj<AbsenceService>;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockNotificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;

    // Setup default mocks
    mockAuthService.activeUser.and.returnValue(mockUser);
    mockAbsenceService.addComment.and.returnValue(of(mockComments[0]));

    // Set required inputs
    component.absenceId = 1;
    component.comments.set(mockComments);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form correctly', () => {
    expect(component.commentForm).toBeDefined();
    expect(component.commentForm.get('content')?.value).toBe('');
    expect(component.commentForm.get('comment_type')?.value).toBe('user_comment');
    expect(component.commentForm.get('is_internal')?.value).toBe(false);
  });

  it('should identify own comments correctly', () => {
    const comment = mockComments[0];
    expect(component.isOwnComment(comment)).toBeTrue();

    const otherUserComment = { ...comment, author: { ...mockUser, id: 999 } };
    expect(component.isOwnComment(otherUserComment)).toBeFalse();
  });

  it('should return correct author icons', () => {
    expect(component.getAuthorIcon('user_comment')).toBe('person');
    expect(component.getAuthorIcon('supervisor_note')).toBe('star');
    expect(component.getAuthorIcon('hr_note')).toBe('business');
  });

  it('should return correct comment type colors', () => {
    expect(component.getCommentTypeColor('user_comment')).toBe('primary');
    expect(component.getCommentTypeColor('supervisor_note')).toBe('warning');
    expect(component.getCommentTypeColor('hr_note')).toBe('tertiary');
  });

  it('should return correct comment type labels', () => {
    expect(component.getCommentTypeLabel('user_comment')).toBe('Mitarbeiter');
    expect(component.getCommentTypeLabel('supervisor_note')).toBe('Vorgesetzter');
    expect(component.getCommentTypeLabel('hr_note')).toBe('HR');
    expect(component.getCommentTypeLabel('unknown')).toBe('Unbekannt');
  });

  it('should allow supervisors to add comments', () => {
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: true });
    expect(component.canAddComment()).toBeTrue();
  });

  it('should allow staff to add comments', () => {
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_staff: true });
    expect(component.canAddComment()).toBeTrue();
  });

  it('should show comment type selection for supervisors', () => {
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: true });
    expect(component.showCommentTypeSelection()).toBeTrue();
  });

  it('should allow supervisors to create supervisor notes', () => {
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: true });
    expect(component.canCreateSupervisorNote()).toBeTrue();
  });

  it('should allow staff to create HR notes', () => {
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_staff: true });
    expect(component.canCreateHRNote()).toBeTrue();
  });

  it('should allow internal comments for supervisors and staff', () => {
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: true });
    expect(component.canCreateInternalComment()).toBeTrue();

    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_staff: true });
    expect(component.canCreateInternalComment()).toBeTrue();
  });

  it('should submit comment successfully', async () => {
    component.commentForm.patchValue({
      content: 'Test comment content',
      comment_type: 'user_comment',
      is_internal: false
    });

    await component.submitComment();

    expect(mockAbsenceService.addComment).toHaveBeenCalledWith(1, {
      content: 'Test comment content',
      comment_type: 'user_comment',
      is_internal: false
    });
    expect(mockNotificationService.notifySuccess).toHaveBeenCalledWith('Kommentar erfolgreich hinzugefügt');
    expect(component.commentForm.get('content')?.value).toBe('');
  });

  it('should handle comment submission error', async () => {
    mockAbsenceService.addComment.and.returnValue(throwError(() => new Error('API Error')));
    
    component.commentForm.patchValue({
      content: 'Test comment content'
    });

    await component.submitComment();

    expect(mockNotificationService.notifyError).toHaveBeenCalledWith('Fehler beim Hinzufügen des Kommentars');
    expect(component.isSubmitting()).toBeFalse();
  });

  it('should not submit invalid form', async () => {
    component.commentForm.patchValue({
      content: '' // Invalid - too short
    });

    await component.submitComment();

    expect(mockAbsenceService.addComment).not.toHaveBeenCalled();
  });

  it('should track comments by id', () => {
    const comment = mockComments[0];
    expect(component.trackByCommentId(0, comment)).toBe(comment.id);
  });

  it('should reply to comment correctly', () => {
    const comment = mockComments[0];
    component.replyToComment(comment);

    expect(component.commentForm.get('content')?.value).toContain('@Test User:');
  });
});
