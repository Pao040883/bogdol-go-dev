/**
 * API Service für Backend REST Endpoints
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

import {
  Company,
  Department,
  Team,
  DepartmentRole,
  DepartmentMember,
  OrgChartNode,
  UserProfile,
  UserPresence,
  ChatConversation,
  ChatMessage,
  PaginatedResponse,
  ProfileSearchQuery,
  DepartmentTreeNode
} from '../models/intranet.models';

@Injectable({
  providedIn: 'root'
})
export class IntranetApiService {
  private readonly API_URL = '/api';

  constructor(private http: HttpClient) {}

  // ========================================================================
  // COMPANIES
  // ========================================================================

  getCompanies(page: number = 1): Observable<PaginatedResponse<Company>> {
    return this.http.get<PaginatedResponse<Company>>(
      `${this.API_URL}/companies/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  getCompany(id: number): Observable<Company> {
    return this.http.get<Company>(
      `${this.API_URL}/companies/${id}/`
    );
  }

  createCompany(data: Partial<Company>): Observable<Company> {
    return this.http.post<Company>(
      `${this.API_URL}/companies/`,
      data
    );
  }

  updateCompany(id: number, data: Partial<Company>): Observable<Company> {
    return this.http.put<Company>(
      `${this.API_URL}/companies/${id}/`,
      data
    );
  }

  deleteCompany(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.API_URL}/companies/${id}/`
    );
  }

  // ========================================================================
  // DEPARTMENTS
  // ========================================================================

  getDepartments(page: number = 1): Observable<PaginatedResponse<Department>> {
    return this.http.get<PaginatedResponse<Department>>(
      `${this.API_URL}/departments/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  getDepartmentTree(): Observable<DepartmentTreeNode[]> {
    return this.http.get<DepartmentTreeNode[]>(
      `${this.API_URL}/departments/tree/`
    );
  }

  getDepartment(id: number): Observable<Department> {
    return this.http.get<Department>(
      `${this.API_URL}/departments/${id}/`
    );
  }

  getDepartmentMembers(id: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.API_URL}/departments/${id}/members/`
    );
  }

  createDepartment(data: any): Observable<Department> {
    return this.http.post<Department>(
      `${this.API_URL}/departments/`,
      data
    );
  }

  updateDepartment(id: number, data: any): Observable<Department> {
    return this.http.put<Department>(
      `${this.API_URL}/departments/${id}/`,
      data
    );
  }

  deleteDepartment(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.API_URL}/departments/${id}/`
    );
  }

  getOrgChart(orgType?: string): Observable<OrgChartNode[]> {
    let params = new HttpParams();
    if (orgType) {
      params = params.set('org_type', orgType);
    }
    return this.http.get<OrgChartNode[]>(
      `${this.API_URL}/departments/orgchart/`,
      { params }
    );
  }

  // ========================================================================
  // DEPARTMENT ROLES
  // ========================================================================

  getDepartmentRoles(orgType?: string): Observable<DepartmentRole[]> {
    let params = new HttpParams();
    if (orgType) {
      params = params.set('org_type', orgType);
    }
    return this.http.get<DepartmentRole[]>(
      `${this.API_URL}/org-roles/`,
      { params }
    );
  }

  getDepartmentRole(id: number): Observable<DepartmentRole> {
    return this.http.get<DepartmentRole>(
      `${this.API_URL}/org-roles/${id}/`
    );
  }

  createDepartmentRole(data: Partial<DepartmentRole>): Observable<DepartmentRole> {
    return this.http.post<DepartmentRole>(
      `${this.API_URL}/org-roles/`,
      data
    );
  }

  updateDepartmentRole(id: number, data: Partial<DepartmentRole>): Observable<DepartmentRole> {
    return this.http.put<DepartmentRole>(
      `${this.API_URL}/org-roles/${id}/`,
      data
    );
  }

  deleteDepartmentRole(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.API_URL}/org-roles/${id}/`
    );
  }

  // ========================================================================
  // DEPARTMENT MEMBERS
  // ========================================================================

  getDepartmentMembers2(departmentId?: number, userId?: number): Observable<PaginatedResponse<DepartmentMember>> {
    let params = new HttpParams();
    if (departmentId) {
      params = params.set('department', departmentId.toString());
    }
    if (userId) {
      params = params.set('user', userId.toString());
    }
    return this.http.get<PaginatedResponse<DepartmentMember>>(
      `${this.API_URL}/org-members/`,
      { params }
    );
  }

  getDepartmentMember(id: number): Observable<DepartmentMember> {
    return this.http.get<DepartmentMember>(
      `${this.API_URL}/org-members/${id}/`
    );
  }

  getMembersByUser(userId: number): Observable<DepartmentMember[]> {
    return this.http.get<DepartmentMember[]>(
      `${this.API_URL}/org-members/by-user/${userId}/`
    );
  }

  createDepartmentMember(data: Partial<DepartmentMember>): Observable<DepartmentMember> {
    return this.http.post<DepartmentMember>(
      `${this.API_URL}/org-members/`,
      data
    );
  }

  updateDepartmentMember(id: number, data: Partial<DepartmentMember>): Observable<DepartmentMember> {
    return this.http.put<DepartmentMember>(
      `${this.API_URL}/org-members/${id}/`,
      data
    );
  }

  deleteDepartmentMember(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.API_URL}/org-members/${id}/`
    );
  }

  // ========================================================================
  // TEAMS
  // ========================================================================

  getTeams(page: number = 1): Observable<PaginatedResponse<Team>> {
    return this.http.get<PaginatedResponse<Team>>(
      `${this.API_URL}/teams/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  getTeam(id: number): Observable<Team> {
    return this.http.get<Team>(
      `${this.API_URL}/teams/${id}/`
    );
  }

  getTeamMembers(id: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.API_URL}/teams/${id}/members/`
    );
  }

  // ========================================================================
  // USER PROFILES
  // ========================================================================

  getProfiles(page: number = 1): Observable<PaginatedResponse<UserProfile>> {
    return this.http.get<PaginatedResponse<UserProfile>>(
      `${this.API_URL}/profiles/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  getProfile(id: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(
      `${this.API_URL}/profiles/${id}/`
    );
  }

  getMyProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(
      `${this.API_URL}/profiles/me/`
    );
  }

  getUsers(): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/admin/users/`
    ).pipe(
      map((response: any) => response.results || response)
    );
  }

  searchProfiles(query: ProfileSearchQuery, page: number = 1): Observable<PaginatedResponse<UserProfile>> {
    let params = new HttpParams()
      .set('page', page.toString());

    if (query.q) params = params.set('q', query.q);
    if (query.department) params = params.set('department', query.department.toString());
    if (query.job_title) params = params.set('job_title', query.job_title);
    if (query.expertise) params = params.set('expertise', query.expertise);
    if (query.location) params = params.set('location', query.location);
    if (query.semantic) params = params.set('semantic', 'true');

    return this.http.get<PaginatedResponse<UserProfile>>(
      `${this.API_URL}/profiles/search/`,
      { params }
    );
  }

  updateProfile(id: number, data: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.put<UserProfile>(
      `${this.API_URL}/profiles/${id}/`,
      data
    );
  }

  // ========================================================================
  // E2E ENCRYPTION - PUBLIC KEYS
  // ========================================================================

  uploadPublicKey(publicKey: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/profiles/upload_public_key/`,
      { public_key: publicKey }
    );
  }

  getPublicKeys(userIds: number[]): Observable<{ [userId: string]: { user_id: number; username: string; public_key: string; updated_at: string | null } }> {
    const params = new HttpParams().set('user_ids', userIds.join(','));
    return this.http.get<any>(
      `${this.API_URL}/profiles/get_public_keys/`,
      { params }
    );
  }

  // ========================================================================
  // PRESENCE
  // ========================================================================

  getPresence(page: number = 1): Observable<PaginatedResponse<UserPresence>> {
    return this.http.get<PaginatedResponse<UserPresence>>(
      `${this.API_URL}/presence/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  getUserPresence(userId: number): Observable<UserPresence> {
    return this.http.get<UserPresence>(
      `${this.API_URL}/presence/${userId}/`
    );
  }

  // ========================================================================
  // CHAT CONVERSATIONS
  // ========================================================================

  getConversations(page: number = 1): Observable<PaginatedResponse<ChatConversation>> {
    return this.http.get<PaginatedResponse<ChatConversation>>(
      `${this.API_URL}/chats/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  findConversationWithUser(userId: number): Observable<ChatConversation | null> {
    return this.http.get<PaginatedResponse<ChatConversation>>(
      `${this.API_URL}/chats/`,
      { params: new HttpParams().set('page_size', '1000') }
    ).pipe(
      map(response => {      
        // Find direct conversation with this user (current user must also be participant)
        const conversation = response.results.find(conv => {
          const isDirect = conv.conversation_type === 'direct';
          const hasUser = conv.participants?.includes(userId);
          return isDirect && hasUser;
        });
        
        return conversation || null;
      })
    );
  }

  getConversation(id: number): Observable<ChatConversation> {
    return this.http.get<ChatConversation>(
      `${this.API_URL}/chats/${id}/`
    );
  }

  createConversation(data: Partial<ChatConversation>): Observable<ChatConversation> {
    return this.http.post<ChatConversation>(
      `${this.API_URL}/chats/`,
      data
    );
  }

  updateConversation(id: number, data: Partial<ChatConversation>): Observable<ChatConversation> {
    return this.http.put<ChatConversation>(
      `${this.API_URL}/chats/${id}/`,
      data
    );
  }

  markConversationAsRead(id: number): Observable<any> {
    return this.http.post(
      `${this.API_URL}/chats/${id}/mark_as_read/`,
      {}
    );
  }

  hideConversation(id: number): Observable<any> {
    return this.http.post(
      `${this.API_URL}/chats/${id}/hide/`,
      {}
    );
  }

  unhideConversation(id: number): Observable<any> {
    return this.http.post(
      `${this.API_URL}/chats/${id}/unhide/`,
      {}
    );
  }

  getConversationMessages(id: number, page: number = 1): Observable<PaginatedResponse<ChatMessage>> {
    return this.http.get<PaginatedResponse<ChatMessage>>(
      `${this.API_URL}/chats/${id}/messages/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  // ========================================================================
  // CHAT MESSAGES
  // ========================================================================

  getMessages(page: number = 1): Observable<PaginatedResponse<ChatMessage>> {
    return this.http.get<PaginatedResponse<ChatMessage>>(
      `${this.API_URL}/messages/`,
      { params: new HttpParams().set('page', page.toString()) }
    );
  }

  sendMessage(conversationId: number, data: Partial<ChatMessage>): Observable<ChatMessage> {
    const payload = {
      ...data,
      conversation: conversationId
    };
    return this.http.post<ChatMessage>(
      `${this.API_URL}/messages/`,
      payload
    );
  }

  sendMessageWithFile(conversationId: number, content: string, file: File, isEncrypted: boolean = false): Observable<ChatMessage> {
    const formData = new FormData();
    formData.append('conversation', conversationId.toString());
    formData.append('content', content);
    formData.append('message_type', 'file');
    formData.append('file', file, file.name);
    formData.append('file_name', file.name);
    formData.append('file_size', file.size.toString());
    formData.append('file_type', file.type);
    formData.append('is_encrypted', isEncrypted.toString());
    
    return this.http.post<ChatMessage>(
      `${this.API_URL}/messages/`,
      formData
    );
  }

  markMessageAsRead(messageId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/messages/${messageId}/mark_read/`, {});
  }

  deleteMessage(messageId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/messages/${messageId}/`);
  }

  editMessage(id: number, content: string): Observable<ChatMessage> {
    return this.http.put<ChatMessage>(
      `${this.API_URL}/messages/${id}/`,
      { content }
    );
  }

  addMessageReaction(id: number, emoji: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/messages/${id}/reactions/`,
      { emoji }
    );
  }

  removeMessageReaction(id: number, emoji: string): Observable<any> {
    return this.http.delete(
      `${this.API_URL}/messages/${id}/reactions_remove/?emoji=${emoji}`
    );
  }
}
