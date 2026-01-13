import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface FakturaEmployee {
  id: number;
  username: string;
  name: string;
  department?: {
    id: number;
    name: string;
  };
  roles?: Array<{
    id: number;
    name: string;
  }>;
  assignment?: {
    assignment_id: number;
    faktura_processor_id: number;
    faktura_processor_name: string;
    is_my_assignment: boolean;
    created_at: string;
  };
}

export interface FakturaAssignment {
  id: number;
  employee: FakturaEmployee;
  faktura_processor: number;
  department?: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFakturaAssignment {
  employee_id: number;
  department_id?: number;
  valid_from: string | null;
  valid_until: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class FakturaAssignmentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Lade alle Faktura-Mitarbeiter (Faktura-Rolle)
   */
  async getFakturaEmployees(): Promise<FakturaEmployee[]> {
    return firstValueFrom(
      this.http.get<FakturaEmployee[]>(`${this.apiUrl}/faktura/assignments/employees/`)
    );
  }

  /**
   * Lade meine Zuweisungen (wo ich faktura_processor bin)
   */
  async getMyAssignments(): Promise<FakturaAssignment[]> {
    return firstValueFrom(
      this.http.get<FakturaAssignment[]>(`${this.apiUrl}/faktura/assignments/my/`)
    );
  }

  /**
   * Erstelle neue Zuweisung
   */
  async createAssignment(data: CreateFakturaAssignment): Promise<FakturaAssignment> {
    return firstValueFrom(
      this.http.post<FakturaAssignment>(`${this.apiUrl}/faktura/assignments/`, data)
    );
  }

  /**
   * Lösche Zuweisung
   */
  async deleteAssignment(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/faktura/assignments/${id}/`)
    );
  }

  /**
   * Lade alle Zuweisungen eines Faktura-Mitarbeiters
   */
  async getEmployeeAssignments(employeeId: number): Promise<FakturaAssignment[]> {
    return firstValueFrom(
      this.http.get<FakturaAssignment[]>(`${this.apiUrl}/faktura/assignments/?employee=${employeeId}`)
    );
  }
}
