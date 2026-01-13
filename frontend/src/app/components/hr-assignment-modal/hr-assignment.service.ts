import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

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
}

export interface HRAssignment {
  id: number;
  employee: {
    id: number;
    username: string;
    name: string;
  };
  hr_processor: {
    id: number;
    username: string;
    name: string;
  };
  department?: {
    id: number;
    name: string;
    code: string;
  };
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateHRAssignmentRequest {
  employee_id: number;
  department_id?: number;
  valid_from?: string | null;
  valid_until?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HRAssignmentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Holt alle Service Manager (Role code='SM')
   */
  async getServiceManagers(): Promise<ServiceManager[]> {
    return firstValueFrom(
      this.http.get<ServiceManager[]>(`${this.apiUrl}/profiles/service-managers/`)
    );
  }

  /**
   * Holt meine HR-Zuweisungen (wo ich hr_processor bin)
   */
  async getMyAssignments(): Promise<HRAssignment[]> {
    return firstValueFrom(
      this.http.get<HRAssignment[]>(`${this.apiUrl}/hr-assignments/my/`)
    );
  }

  /**
   * Erstellt eine neue HR-Zuweisung
   * (Aktueller User wird automatisch als hr_processor gesetzt)
   */
  async createAssignment(data: CreateHRAssignmentRequest): Promise<HRAssignment> {
    return firstValueFrom(
      this.http.post<HRAssignment>(`${this.apiUrl}/hr-assignments/`, data)
    );
  }

  /**
   * Löscht/Deaktiviert eine HR-Zuweisung
   */
  async deleteAssignment(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/hr-assignments/${id}/`)
    );
  }

  /**
   * Aktualisiert eine HR-Zuweisung
   */
  async updateAssignment(id: number, data: Partial<CreateHRAssignmentRequest>): Promise<HRAssignment> {
    return firstValueFrom(
      this.http.patch<HRAssignment>(`${this.apiUrl}/hr-assignments/${id}/`, data)
    );
  }
}
