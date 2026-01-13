import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { ErrorHandlingService } from './error-handling.service';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

// Backend API Response Types
export interface BackendEvaluationResponse {
  success: boolean;
  data: {
    serviceManagers: BackendServiceManager[];
    summary: BackendSummary;
    locations: BackendLocation[];
  };
  meta: {
    user_company: number;
    user_id: number;
    period: {
      start: string;
      end: string;
    };
    generated_at: string;
  };
}

export interface BackendServiceManager {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  statistics?: {
    totalWorklogs: number;
    totalMinutes: number;
    totalHours: number;
    exportedWorklogs: number;
    exportPercentage: number;
    uniqueLocations: number;
    completedLocations: number;  // ✅ NEUE METRIK
    statusCounts: Record<string, number>;
  };
  locations: BackendLocation[];
}

export interface BackendSummary {
  totalManagers: number;
  managersWithData: number;
  totalLocations: number;
  completedLocations: number;  // ✅ NEUE METRIK - Standorte wo alle Worklogs exportiert sind
  overallExportPercentage: number;
  totalWorklogs: number;
  totalMinutes: number;
  period: {
    start: string;
    end: string;
    days: number;
  };
}

export interface BackendLocation {
  Id: number;
  Name: string;
  Address?: string;
  City?: string;
  objectNumber?: string;  
  statuses?: Record<string, number>;  
  hasData?: boolean;  // ✅ HINZUGEFÜGT - Flag ob Location Worklog-Daten hat
}

export interface BlinkEvaluationConfig {
  startDate: Date;
  endDate: Date;
  selectedAreas?: string[];
  selectedManagers?: string[];
  includeInactive?: boolean;
}

export interface BlinkEvaluationResult {
  serviceManagers: BackendServiceManager[];
  summary: BackendSummary;
  locations: BackendLocation[];
  generatedAt: Date;
  config: BlinkEvaluationConfig;
}

@Injectable({
  providedIn: 'root'
})
export class SecureBlinkEvaluationService {
  private http = inject(HttpClient);
  private errorHandler = inject(ErrorHandlingService);
  private notificationService = inject(NotificationService);

  // API Base URL für Backend
  private readonly API_BASE = `${environment.apiUrl}/blink`;

  // State Management
  private evaluationResult = signal<BlinkEvaluationResult | null>(null);
  private loadingState = signal(false);

  // Public Computed Properties
  currentResult = computed(() => this.evaluationResult());
  isLoading = computed(() => this.loadingState());
  isReady = computed(() => true); // Immer bereit, da Backend die Authentifizierung übernimmt

  /**
   * Test die Backend Authentifizierung
   */
  testAuthentication(): Observable<any> {
    const url = `${this.API_BASE}/test-auth/`;
    
    this.loadingState.set(true);
    
    return this.http.get<any>(url).pipe(
      map(response => {
        console.log('✅ Backend Authentifizierung erfolgreich:', response);
        return response;
      }),
      catchError(error => {
        console.error('❌ Backend Authentifizierung fehlgeschlagen:', error);
        throw error;
      }),
      finalize(() => this.loadingState.set(false))
    );
  }

  constructor() {
    console.log('🔄 Initializing Secure Blink Evaluation Service...');
  }

  /**
   * Run evaluation through secure backend endpoint
   */
  async runEvaluation(config: BlinkEvaluationConfig): Promise<BlinkEvaluationResult> {
    this.loadingState.set(true);
    
    try {
      console.log('🔄 Starting secure Blink evaluation via backend...', config);

      const payload = {
        startDate: config.startDate.toISOString(),
        endDate: config.endDate.toISOString(),
        selectedAreas: config.selectedAreas || [],
        selectedManagers: config.selectedManagers || [],
        includeInactive: config.includeInactive || false
      };

      const response = await this.http.post<BackendEvaluationResponse>(
        `${this.API_BASE}/evaluation/`,
        payload
      ).pipe(
        catchError(error => {
          console.error('❌ Backend evaluation failed:', error);
          this.errorHandler.handleHttpError(error, 'Blink Auswertung');
          throw error;
        })
      ).toPromise();

      if (!response?.success) {
        throw new Error('Backend-Antwort war nicht erfolgreich');
      }

      // Backend-Response in Frontend-Format konvertieren
      const result: BlinkEvaluationResult = {
        serviceManagers: response.data.serviceManagers,
        summary: response.data.summary,
        locations: response.data.locations,
        generatedAt: new Date(response.meta.generated_at),
        config
      };

      this.evaluationResult.set(result);
      
      this.notificationService.showToast(
        `Sichere Auswertung für ${result.serviceManagers.length} Service Manager abgeschlossen`,
        'success',
        4000
      );

      console.log('✅ Secure evaluation completed', result);
      return result;

    } catch (error) {
      this.errorHandler.handleGenericError(error as Error, 'Sichere Blink Auswertung');
      throw error;
    } finally {
      this.loadingState.set(false);
    }
  }

  /**
   * Export evaluation result as JSON
   */
  exportResult(format: 'json' | 'csv' = 'json'): void {
    const result = this.currentResult();
    if (!result) {
      this.notificationService.showToast(
        'Keine Auswertung zum Exportieren vorhanden',
        'warning',
        3000
      );
      return;
    }

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(result, null, 2);
        filename = `blink-auswertung-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        content = this.convertToCSV(result);
        filename = `blink-auswertung-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.notificationService.showToast(
        `Sichere Auswertung als ${format.toUpperCase()} exportiert`,
        'success',
        3000
      );
    } catch (error) {
      this.errorHandler.handleGenericError(error as Error, 'Export');
    }
  }

  private convertToCSV(result: BlinkEvaluationResult): string {
    const headers = ['Manager', 'Vorname', 'Nachname', 'Worklogs Total', 'Minuten Total', 'Stunden Total', 'Exportiert', 'Export %', 'Standorte'];
    const rows = result.serviceManagers.map(sm => [
      sm.fullName,
      sm.firstName,
      sm.lastName,
      (sm.statistics?.totalWorklogs ?? 0).toString(),
      (sm.statistics?.totalMinutes ?? 0).toString(),
      (sm.statistics?.totalHours ?? 0).toString(),
      (sm.statistics?.exportedWorklogs ?? 0).toString(),
      (sm.statistics?.exportPercentage ?? 0).toString(),
      (sm.statistics?.uniqueLocations ?? 0).toString()
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
}
