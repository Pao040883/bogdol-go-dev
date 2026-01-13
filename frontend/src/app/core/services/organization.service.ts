import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Specialty,
  MemberSpecialty,
  DepartmentMemberDetail,
  WorkorderAssignment,
  SubstituteAssignment,
  PermissionCheckRequest,
  PermissionCheckResponse,
  MyAssignmentsResponse,
  MySubstitutionsResponse,
  AutoAssignRequest,
  AutoAssignResponse
} from '../../models/organization.model';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  // ==================== Specialty Endpoints ====================

  getSpecialties(departmentId?: number, search?: string): Observable<Specialty[]> {
    let params = new HttpParams();
    if (departmentId) {
      params = params.set('department', departmentId.toString());
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<any>(`${this.apiUrl}/specialties/`, { params }).pipe(
      map((response: any) => {
        // Handle both array and paginated response formats
        return Array.isArray(response) ? response : (response.results || []);
      })
    );
  }

  getSpecialty(id: number): Observable<Specialty> {
    return this.http.get<Specialty>(`${this.apiUrl}/specialties/${id}/`);
  }

  getSpecialtiesByDepartment(departmentId: number): Observable<Specialty[]> {
    const params = new HttpParams().set('department_id', departmentId.toString());
    return this.http.get<Specialty[]>(`${this.apiUrl}/specialties/by_department/`, { params });
  }

  createSpecialty(specialty: Partial<Specialty>): Observable<Specialty> {
    return this.http.post<Specialty>(`${this.apiUrl}/specialties/`, specialty);
  }

  updateSpecialty(id: number, specialty: Partial<Specialty>): Observable<Specialty> {
    return this.http.put<Specialty>(`${this.apiUrl}/specialties/${id}/`, specialty);
  }

  deleteSpecialty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/specialties/${id}/`);
  }

  // ==================== Member Specialty Endpoints ====================

  getMemberSpecialties(filters?: {
    member?: number;
    user?: number;
    specialty?: number;
    department?: number;
  }): Observable<MemberSpecialty[]> {
    let params = new HttpParams();
    if (filters?.member) params = params.set('member', filters.member.toString());
    if (filters?.user) params = params.set('user', filters.user.toString());
    if (filters?.specialty) params = params.set('specialty', filters.specialty.toString());
    if (filters?.department) params = params.set('department', filters.department.toString());
    
    return this.http.get<MemberSpecialty[]>(`${this.apiUrl}/member-specialties/`, { params });
  }

  getMySpecialties(): Observable<MemberSpecialty[]> {
    return this.http.get<MemberSpecialty[]>(`${this.apiUrl}/member-specialties/my_specialties/`);
  }

  createMemberSpecialty(memberSpecialty: Partial<MemberSpecialty>): Observable<MemberSpecialty> {
    return this.http.post<MemberSpecialty>(`${this.apiUrl}/member-specialties/`, memberSpecialty);
  }

  updateMemberSpecialty(id: number, memberSpecialty: Partial<MemberSpecialty>): Observable<MemberSpecialty> {
    return this.http.put<MemberSpecialty>(`${this.apiUrl}/member-specialties/${id}/`, memberSpecialty);
  }

  deleteMemberSpecialty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/member-specialties/${id}/`);
  }

  // ==================== Department Member Endpoints ====================

  getDepartmentMembers(filters?: {
    department?: number;
    user?: number;
    role?: number;
    active_only?: boolean;
    primary_only?: boolean;
  }): Observable<DepartmentMemberDetail[]> {
    let params = new HttpParams();
    if (filters?.department) params = params.set('department', filters.department.toString());
    if (filters?.user) params = params.set('user', filters.user.toString());
    if (filters?.role) params = params.set('role', filters.role.toString());
    if (filters?.active_only !== undefined) params = params.set('active_only', filters.active_only.toString());
    if (filters?.primary_only !== undefined) params = params.set('primary_only', filters.primary_only.toString());
    
    return this.http.get<DepartmentMemberDetail[]>(`${this.apiUrl}/org-members/`, { params });
  }

  getMyMemberships(): Observable<DepartmentMemberDetail[]> {
    return this.http.get<DepartmentMemberDetail[]>(`${this.apiUrl}/org-members/my_memberships/`);
  }

  getMembersWithSpecialty(specialtyId?: number, specialtyCode?: string): Observable<DepartmentMemberDetail[]> {
    let params = new HttpParams();
    if (specialtyId) params = params.set('specialty_id', specialtyId.toString());
    if (specialtyCode) params = params.set('specialty_code', specialtyCode);
    
    return this.http.get<DepartmentMemberDetail[]>(`${this.apiUrl}/org-members/with_specialty/`, { params });
  }

  // ==================== Workorder Assignment Endpoints ====================

  getWorkorderAssignments(): Observable<WorkorderAssignment[]> {
    return this.http.get<WorkorderAssignment[]>(`${this.apiUrl}/workorder-assignments/`);
  }

  getMyAssignments(): Observable<MyAssignmentsResponse> {
    return this.http.get<MyAssignmentsResponse>(`${this.apiUrl}/workorder-assignments/my_assignments/`);
  }

  createWorkorderAssignment(assignment: Partial<WorkorderAssignment>): Observable<WorkorderAssignment> {
    return this.http.post<WorkorderAssignment>(`${this.apiUrl}/workorder-assignments/`, assignment);
  }

  updateWorkorderAssignment(id: number, assignment: Partial<WorkorderAssignment>): Observable<WorkorderAssignment> {
    return this.http.put<WorkorderAssignment>(`${this.apiUrl}/workorder-assignments/${id}/`, assignment);
  }

  deleteWorkorderAssignment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/workorder-assignments/${id}/`);
  }

  autoAssignWorkorder(request: AutoAssignRequest): Observable<AutoAssignResponse> {
    return this.http.post<AutoAssignResponse>(`${this.apiUrl}/workorder-assignments/auto_assign/`, request);
  }

  // ==================== Substitute Assignment Endpoints ====================

  getSubstituteAssignments(): Observable<SubstituteAssignment[]> {
    return this.http.get<SubstituteAssignment[]>(`${this.apiUrl}/substitute-assignments/`);
  }

  getMySubstitutions(): Observable<MySubstitutionsResponse> {
    return this.http.get<MySubstitutionsResponse>(`${this.apiUrl}/substitute-assignments/my_substitutions/`);
  }

  getActiveSubstitutions(): Observable<SubstituteAssignment[]> {
    return this.http.get<SubstituteAssignment[]>(`${this.apiUrl}/substitute-assignments/active/`);
  }

  createSubstituteAssignment(assignment: Partial<SubstituteAssignment>): Observable<SubstituteAssignment> {
    return this.http.post<SubstituteAssignment>(`${this.apiUrl}/substitute-assignments/`, assignment);
  }

  updateSubstituteAssignment(id: number, assignment: Partial<SubstituteAssignment>): Observable<SubstituteAssignment> {
    return this.http.put<SubstituteAssignment>(`${this.apiUrl}/substitute-assignments/${id}/`, assignment);
  }

  deleteSubstituteAssignment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/substitute-assignments/${id}/`);
  }

  // ==================== Permission Check Endpoints ====================

  checkPermission(request: PermissionCheckRequest): Observable<PermissionCheckResponse> {
    let params = new HttpParams().set('action', request.action);
    
    if (request.specialty_code) params = params.set('specialty_code', request.specialty_code);
    if (request.department) params = params.set('department', request.department.toString());
    if (request.active_only !== undefined) params = params.set('active_only', request.active_only.toString());
    if (request.date) params = params.set('date', request.date);
    if (request.workorder_id) params = params.set('workorder_id', request.workorder_id.toString());
    if (request.absence_id) params = params.set('absence_id', request.absence_id.toString());
    
    return this.http.get<PermissionCheckResponse>(`${this.apiUrl}/permissions/check/`, { params });
  }

  hasFullAccess(): Observable<boolean> {
    return new Observable(observer => {
      this.checkPermission({ action: 'full_access' }).subscribe({
        next: (response) => observer.next(response.has_access || false),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }

  hasSpecialty(specialtyCode: string): Observable<boolean> {
    return new Observable(observer => {
      this.checkPermission({ action: 'has_specialty', specialty_code: specialtyCode }).subscribe({
        next: (response) => observer.next(response.has_specialty || false),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }

  canProcessWorkorder(workorderId: number): Observable<boolean> {
    return new Observable(observer => {
      this.checkPermission({ action: 'can_process_workorder', workorder_id: workorderId }).subscribe({
        next: (response) => observer.next(response.can_process || false),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }

  canViewWorkorder(workorderId: number): Observable<boolean> {
    return new Observable(observer => {
      this.checkPermission({ action: 'can_view_workorder', workorder_id: workorderId }).subscribe({
        next: (response) => observer.next(response.can_view || false),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }

  canApproveAbsence(absenceId: number): Observable<boolean> {
    return new Observable(observer => {
      this.checkPermission({ action: 'can_approve_absence', absence_id: absenceId }).subscribe({
        next: (response) => observer.next(response.can_approve || false),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }
}
