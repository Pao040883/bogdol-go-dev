import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ServiceManager {
  id: number;
  username: string;
  name: string;
  email: string;
  department?: {
    id: number;
    name: string;
    code: string;
  };
  specialty?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface WorkorderAssignment {
  id: number;
  submitter: {
    id: number;
    username: string;
    name: string;
  };
  processor: {
    id: number;
    username: string;
    name: string;
  };
  specialty?: {
    id: number;
    name: string;
    code: string;
  };
  is_auto_assigned: boolean;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkorderAssignmentRequest {
  submitter_id: number;
  specialty_id?: number;
  valid_from?: string;
  valid_until?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkorderAssignmentService {
  private apiUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}
  
  /**
   * Get all Service Managers (users with Role code='SM')
   */
  async getServiceManagers(): Promise<ServiceManager[]> {
    return firstValueFrom(
      this.http.get<ServiceManager[]>(`${this.apiUrl}/profiles/service-managers/`)
    );
  }
  
  /**
   * Get workorder assignments where current user is the processor
   */
  async getMyAssignments(): Promise<WorkorderAssignment[]> {
    return firstValueFrom(
      this.http.get<WorkorderAssignment[]>(`${this.apiUrl}/workorder-assignments/my/`)
    );
  }
  
  /**
   * Create a new workorder assignment
   * processor will be automatically set to current user by backend
   */
  async createAssignment(data: CreateWorkorderAssignmentRequest): Promise<WorkorderAssignment> {
    return firstValueFrom(
      this.http.post<WorkorderAssignment>(`${this.apiUrl}/workorder-assignments/`, data)
    );
  }
  
  /**
   * Delete a workorder assignment
   */
  async deleteAssignment(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/workorder-assignments/${id}/`)
    );
  }
  
  /**
   * Update a workorder assignment
   */
  async updateAssignment(id: number, data: Partial<CreateWorkorderAssignmentRequest>): Promise<WorkorderAssignment> {
    return firstValueFrom(
      this.http.patch<WorkorderAssignment>(`${this.apiUrl}/workorder-assignments/${id}/`, data)
    );
  }
}
