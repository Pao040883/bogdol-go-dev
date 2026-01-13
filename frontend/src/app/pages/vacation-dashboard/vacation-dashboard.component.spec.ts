import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { VacationDashboardComponent } from './vacation-dashboard.component';
import { AbsenceService } from '../../core/services/absence.service';
import { AuthService } from '../../core/services/auth.service';
import { VacationSummary, Absence } from '../../core/interfaces/absence.types';
import { Users } from '../../core/interfaces/users';

describe('VacationDashboardComponent', () => {
  let component: VacationDashboardComponent;
  let fixture: ComponentFixture<VacationDashboardComponent>;
  let mockAbsenceService: jasmine.SpyObj<AbsenceService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockVacationSummary: VacationSummary = {
    vacation_entitlement: 30,
    carryover_vacation: 5,
    vacation_year: 2024,
    used_vacation_days: 15,
    remaining_vacation_days: 20,
    total_entitlement: 35
  };

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

  const mockAbsences: Absence[] = [
    {
      id: 1,
      start_date: '2024-03-01',
      end_date: '2024-03-05',
      status: 'approved',
      duration_days: 5,
      workday_duration: 5,
      absence_type: { 
        id: 1, 
        name: 'Urlaub', 
        display_name: 'Urlaub',
        color_code: '#4ade80', 
        requires_approval: true,
        requires_certificate: false,
        advance_notice_days: 14,
        is_active: true
      },
      reason: 'Test vacation',
      user: mockUser,
      representative_confirmed: false,
      hr_notified: false,
      is_pending: false,
      is_approved: true,
      is_rejected: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    const absenceServiceSpy = jasmine.createSpyObj('AbsenceService', [
      'loadVacationSummary',
      'loadMyAbsences',
      'absences'
    ]);
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['activeUser']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [VacationDashboardComponent],
      providers: [
        { provide: AbsenceService, useValue: absenceServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VacationDashboardComponent);
    component = fixture.componentInstance;
    mockAbsenceService = TestBed.inject(AbsenceService) as jasmine.SpyObj<AbsenceService>;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup default mocks
    mockAbsenceService.loadVacationSummary.and.returnValue(of(mockVacationSummary));
    mockAbsenceService.absences.and.returnValue(mockAbsences);
    mockAuthService.activeUser.and.returnValue(mockUser);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load vacation data on init', () => {
    component.ngOnInit();

    expect(mockAbsenceService.loadVacationSummary).toHaveBeenCalled();
    expect(mockAbsenceService.loadMyAbsences).toHaveBeenCalled();
  });

  it('should set vacation summary when loaded successfully', () => {
    component.loadVacationData();

    expect(component.vacationSummary()).toEqual(mockVacationSummary);
    expect(component.isLoading()).toBeFalse();
    expect(component.error()).toBeNull();
  });

  it('should handle vacation data loading error', () => {
    mockAbsenceService.loadVacationSummary.and.returnValue(throwError(() => new Error('API Error')));

    component.loadVacationData();

    expect(component.error()).toBe('Fehler beim Laden der Urlaubsdaten');
    expect(component.isLoading()).toBeFalse();
  });

  it('should calculate vacation usage percentage correctly', () => {
    component.vacationSummary.set(mockVacationSummary);

    const percentage = component.getVacationUsagePercentage();
    
    expect(percentage).toBe(43); // 15/35 * 100 = 42.86, rounded to 43
  });

  it('should return 0 percentage when no vacation summary', () => {
    component.vacationSummary.set(null);

    const percentage = component.getVacationUsagePercentage();
    
    expect(percentage).toBe(0);
  });

  it('should calculate vacation usage ratio correctly', () => {
    component.vacationSummary.set(mockVacationSummary);

    const ratio = component.getVacationUsageRatio();
    
    expect(ratio).toBe(15/35);
  });

  it('should get correct progress color based on usage', () => {
    // Test low usage (success)
    component.vacationSummary.set({
      ...mockVacationSummary,
      used_vacation_days: 10,
      total_entitlement: 30
    });
    expect(component.getProgressColor()).toBe('success');

    // Test medium usage (warning)
    component.vacationSummary.set({
      ...mockVacationSummary,
      used_vacation_days: 20,
      total_entitlement: 30
    });
    expect(component.getProgressColor()).toBe('warning');

    // Test high usage (danger)
    component.vacationSummary.set({
      ...mockVacationSummary,
      used_vacation_days: 25,
      total_entitlement: 30
    });
    expect(component.getProgressColor()).toBe('danger');
  });

  it('should get correct status color', () => {
    expect(component.getStatusColor('approved')).toBe('success');
    expect(component.getStatusColor('pending')).toBe('warning');
    expect(component.getStatusColor('rejected')).toBe('danger');
    expect(component.getStatusColor('cancelled')).toBe('medium');
    expect(component.getStatusColor('unknown')).toBe('primary');
  });

  it('should get correct status label', () => {
    expect(component.getStatusLabel('pending')).toBe('Ausstehend');
    expect(component.getStatusLabel('approved')).toBe('Genehmigt');
    expect(component.getStatusLabel('rejected')).toBe('Abgelehnt');
    expect(component.getStatusLabel('cancelled')).toBe('Storniert');
    expect(component.getStatusLabel('unknown')).toBe('unknown');
  });

  it('should detect manager users correctly', () => {
    // Test supervisor
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: true, is_staff: false });
    expect(component.isManager()).toBeTrue();

    // Test staff
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: false, is_staff: true });
    expect(component.isManager()).toBeTrue();

    // Test regular user
    mockAuthService.activeUser.and.returnValue({ ...mockUser, is_supervisor: false, is_staff: false });
    expect(component.isManager()).toBeFalse();

    // Test null user
    mockAuthService.activeUser.and.returnValue(null);
    expect(component.isManager()).toBeFalse();
  });

  it('should navigate to request vacation page', () => {
    component.requestVacation();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/absences/request']);
  });

  it('should navigate to my absences page', () => {
    component.viewMyAbsences();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/absences/my']);
  });

  it('should navigate to team absences page', () => {
    component.viewTeamAbsences();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/absences/team']);
  });

  it('should refresh all data', () => {
    spyOn(component, 'loadVacationData');
    spyOn(component, 'loadRecentVacations');

    component.refreshData();

    expect(component.loadVacationData).toHaveBeenCalled();
    expect(component.loadRecentVacations).toHaveBeenCalled();
    expect(mockAbsenceService.loadMyAbsences).toHaveBeenCalled();
  });

  it('should filter recent vacations correctly', () => {
    const vacationAbsences = [
      { ...mockAbsences[0], absence_type: { ...mockAbsences[0].absence_type, name: 'Urlaub' } },
      { ...mockAbsences[0], id: 2, absence_type: { ...mockAbsences[0].absence_type, name: 'Krankmeldung' } }
    ];
    
    mockAbsenceService.absences.and.returnValue(vacationAbsences);

    component.loadRecentVacations();

    expect(component.recentVacations().length).toBe(1);
    expect(component.recentVacations()[0].absence_type.name).toBe('Urlaub');
  });
});
