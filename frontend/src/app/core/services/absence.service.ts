// Erweiterte Absence Service für das optimierte System

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, tap, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Absence, 
  AbsenceType, 
  AbsenceCreateRequest, 
  AbsenceApprovalRequest,
  AbsenceFilters,
  AbsenceComment,
  VacationSummary,
  CommentRequest,
  RevisionRequest
} from '../interfaces/absence.types';
import { NotificationService } from './notification.service';
import { ErrorHandlingService } from './error-handling.service';

@Injectable({
  providedIn: 'root',
})
export class AbsenceService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlingService);
  private readonly baseUrl = `${environment.apiUrl}/absences/api`;

  // State Signals
  readonly absences = signal<Absence[]>([]);
  readonly absenceTypes = signal<AbsenceType[]>([]);
  readonly pendingApprovals = signal<Absence[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadAbsenceTypes();
    this.loadMyAbsences();
  }

  // ===== ABSENCE TYPES =====
  
  /** Lade verfügbare Abwesenheitstypen */
  loadAbsenceTypes(): void {
    this.http.get<AbsenceType[]>(`${this.baseUrl}/absence-types/`)
      .pipe(
        tap((types) => {
          this.absenceTypes.set(types);
        }),
        catchError((err) => {
          console.error('Fehler beim Laden der Abwesenheitstypen:', err);
          return of([]);
        })
      )
      .subscribe();
  }

  /** Hole einen spezifischen Abwesenheitstyp */
  getAbsenceType(id: number): AbsenceType | undefined {
    return this.absenceTypes().find(type => type.id === id);
  }

  /** Erstelle neuen Abwesenheitstyp */
  async createAbsenceType(typeData: Partial<AbsenceType>): Promise<AbsenceType> {
    try {
      const type = await this.http.post<AbsenceType>(`${this.baseUrl}/absence-types/`, typeData).toPromise();
      this.loadAbsenceTypes(); // Reload
      this.notificationService.notifySuccess('Abwesenheitsart erfolgreich erstellt');
      return type!;
    } catch (error) {
      this.notificationService.notifyError('Fehler beim Erstellen der Abwesenheitsart');
      throw error;
    }
  }

  /** Aktualisiere Abwesenheitstyp */
  async updateAbsenceType(id: number, typeData: Partial<AbsenceType>): Promise<AbsenceType> {
    try {
      const type = await this.http.patch<AbsenceType>(`${this.baseUrl}/absence-types/${id}/`, typeData).toPromise();
      this.loadAbsenceTypes(); // Reload
      this.notificationService.notifySuccess('Abwesenheitsart erfolgreich aktualisiert');
      return type!;
    } catch (error) {
      this.notificationService.notifyError('Fehler beim Aktualisieren der Abwesenheitsart');
      throw error;
    }
  }

  /** Lösche Abwesenheitstyp */
  async deleteAbsenceType(id: number): Promise<void> {
    try {
      await this.http.delete(`${this.baseUrl}/absence-types/${id}/`).toPromise();
      this.loadAbsenceTypes(); // Reload
      this.notificationService.notifySuccess('Abwesenheitsart erfolgreich gelöscht');
    } catch (error) {
      this.notificationService.notifyError('Fehler beim Löschen der Abwesenheitsart');
      throw error;
    }
  }

  // ===== ABSENCES CRUD =====

  /** Lade eine spezifische Abwesenheit nach ID */
  loadAbsence(id: number): Observable<Absence> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<Absence>(`${this.baseUrl}/absences/${id}/`).pipe(
      tap((absence) => {
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        this.error.set('Fehler beim Laden der Abwesenheit');
        this.notificationService.notifyError('Fehler beim Laden der Abwesenheit');
        throw err;
      })
    );
  }

  /** Lade eigene Abwesenheiten */
  loadMyAbsences(year?: number): void {
    this.isLoading.set(true);
    let params = new HttpParams();
    if (year) {
      params = params.set('year', year.toString());
    }
    this.http.get<Absence[]>(`${this.baseUrl}/absences/my_absences/`, { params })
      .pipe(
        tap((data) => {
          this.absences.set(data);
          this.error.set(null);
        }),
        catchError((err) => {
          this.error.set('Fehler beim Laden der Abwesenheiten');
          return of([]);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Lade alle Abwesenheiten (für Vorgesetzte/HR) */
  loadAllAbsences(filters?: AbsenceFilters): void {
    this.isLoading.set(true);
    
    let params = new HttpParams();
    if (filters) {
      if (filters.status?.length) {
        filters.status.forEach(status => params = params.append('status', status));
      }
      if (filters.absence_type?.length) {
        filters.absence_type.forEach(type => params = params.append('absence_type', type.toString()));
      }
      if (filters.start_date) {
        params = params.set('start_date__gte', filters.start_date);
      }
      if (filters.end_date) {
        params = params.set('end_date__lte', filters.end_date);
      }
    }

    this.http.get<Absence[]>(`${this.baseUrl}/absences/`, { params })
      .pipe(
        tap((data) => {
          this.absences.set(data);
          this.error.set(null);
        }),
        catchError((err) => {
          this.error.set('Fehler beim Laden der Abwesenheiten');
          return of([]);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Prüfe auf Überschneidungen mit bestehenden Abwesenheiten */
  checkOverlap(startDate: string, endDate: string, excludeId?: number): { hasOverlap: boolean; overlappingAbsences: Absence[] } {
    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    const overlapping = this.absences().filter(absence => {
      // Überspringe die zu bearbeitende Abwesenheit bei Updates
      if (excludeId && absence.id === excludeId) return false;
      
      // Überspringe abgelehnte oder stornierte Abwesenheiten
      if (absence.status === 'rejected' || absence.status === 'cancelled') return false;

      const existingStart = new Date(absence.start_date);
      const existingEnd = new Date(absence.end_date);

      // Prüfe auf Überschneidung
      return (newStart <= existingEnd && newEnd >= existingStart);
    });

    return {
      hasOverlap: overlapping.length > 0,
      overlappingAbsences: overlapping
    };
  }

  /** Erstelle neue Abwesenheit */
  createAbsence(request: AbsenceCreateRequest): Observable<Absence | null> {
    this.isLoading.set(true);
    
    // Prüfe auf Überschneidungen vor dem Erstellen
    const overlapCheck = this.checkOverlap(request.start_date, request.end_date);
    if (overlapCheck.hasOverlap) {
      this.isLoading.set(false);
      const overlappingDates = overlapCheck.overlappingAbsences
        .map(a => `${a.start_date} - ${a.end_date}`)
        .join(', ');
      
      this.error.set(`Überschneidung mit bestehenden Abwesenheiten: ${overlappingDates}`);
      this.notificationService.notifyError('Der gewählte Zeitraum überschneidet sich mit bestehenden Abwesenheiten');
      return of(null);
    }
    
    // Use JSON instead of FormData for better compatibility
    const payload = {
      absence_type_id: request.absence_type_id,
      start_date: request.start_date,
      end_date: request.end_date,
      reason: request.reason,
      representative_id: request.representative_id
    };

    // Remove undefined values
    Object.keys(payload).forEach(key => {
      if (payload[key as keyof typeof payload] === undefined) {
        delete payload[key as keyof typeof payload];
      }
    });

    return this.http.post<Absence>(`${this.baseUrl}/absences/`, payload)
      .pipe(
        tap((created: Absence) => {
          this.absences.update((list) => [...list, created]);
          this.error.set(null);
          
          // Get absence type name from the loaded types since the response might not include the full object
          const absenceType = this.getAbsenceType(created.absence_type_id || (created.absence_type as any)?.id || request.absence_type_id);
          const typeName = absenceType?.display_name || 'Abwesenheit';
          
          this.notificationService.notifySuccess(
            `Abwesenheitsantrag für ${typeName} wurde erfolgreich eingereicht`
          );
        }),
        catchError((err) => {
          console.error('Create absence error:', err);
          this.errorHandler.handleHttpError(err, 'AbsenceService.createAbsence').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Erstellen des Abwesenheitsantrags');
          });
          return of(null);
        }),
        tap(() => this.isLoading.set(false))
      );
  }

  /** Aktualisiere Abwesenheit */
  updateAbsence(id: number, request: Partial<AbsenceCreateRequest>): Observable<Absence | null> {
    return this.http.patch<Absence>(`${this.baseUrl}/absences/${id}/`, request)
      .pipe(
        tap((updated: Absence) => {
          this.absences.update((list) =>
            list.map((a) => (a.id === id ? updated : a))
          );
          
          this.notificationService.notifySuccess('Abwesenheit wurde erfolgreich aktualisiert');
        }),
        catchError((err) => {
          this.errorHandler.handleHttpError(err, 'AbsenceService.updateAbsence').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Aktualisieren der Abwesenheit');
          });
          return of(null);
        })
      );
  }

  /** Lösche Abwesenheit */
  deleteAbsence(id: number): Observable<boolean> {
    return this.http.delete(`${this.baseUrl}/absences/${id}/`)
      .pipe(
        tap(() => {
          this.absences.update((list) => list.filter((a) => a.id !== id));
          this.notificationService.notifySuccess('Abwesenheit wurde gelöscht');
        }),
        map(() => true),
        catchError((err) => {
          this.error.set('Fehler beim Löschen der Abwesenheit');
          this.notificationService.notifyError('Fehler beim Löschen der Abwesenheit');
          return of(false);
        })
      );
  }

  // ===== APPROVAL WORKFLOW =====

  /** Lade ausstehende Genehmigungen für Vorgesetzte */
  loadPendingApprovals(): void {
    this.isLoading.set(true);
    this.http.get<Absence[]>(`${this.baseUrl}/absences/pending_approvals/`)
      .pipe(
        tap(data => {
          this.pendingApprovals.set(data);
          this.error.set(null);
        }),
        catchError(err => {
          this.error.set('Fehler beim Laden der ausstehenden Genehmigungen');
          return of([]);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Genehmige Abwesenheit */
  approveAbsence(id: number, comment?: string): Observable<Absence | null> {
    const request: AbsenceApprovalRequest = {
      action: 'approve',
      comment: comment
    };

    return this.http.post<Absence>(`${this.baseUrl}/absences/${id}/approve/`, request)
      .pipe(
        tap((updated: Absence) => {
          this._updateAbsenceInLists(updated);
          
          this.notificationService.notifySuccess(
            `Abwesenheitsantrag von ${updated.user.full_name || updated.user.username} wurde genehmigt`
          );
        }),
        catchError((err) => {
          this.errorHandler.handleHttpError(err, 'AbsenceService.approveAbsence').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Genehmigen des Antrags');
          });
          return of(null);
        })
      );
  }

  /** Lehne Abwesenheit ab */
  rejectAbsence(id: number, reason: string): Observable<Absence | null> {
    const request: AbsenceApprovalRequest = {
      action: 'reject',
      reason: reason
    };

    return this.http.post<Absence>(`${this.baseUrl}/absences/${id}/reject/`, request)
      .pipe(
        tap((updated: Absence) => {
          this._updateAbsenceInLists(updated);
          
          this.notificationService.notifySuccess(
            `Abwesenheitsantrag von ${updated.user.full_name || updated.user.username} wurde abgelehnt`
          );
        }),
        catchError((err) => {
          this.errorHandler.handleHttpError(err, 'AbsenceService.rejectAbsence').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Ablehnen des Antrags');
          });
          return of(null);
        })
      );
  }

  /** HR-Benachrichtigung senden */
  notifyHR(id: number, comment?: string): Observable<Absence | null> {
    return this.http.post<Absence>(`${this.baseUrl}/absences/${id}/hr_notify/`, { hr_comment: comment })
      .pipe(
        tap((updated: Absence) => {
          this._updateAbsenceInLists(updated);
          
          this.notificationService.notifySuccess('HR wurde über die Abwesenheit benachrichtigt');
        }),
        catchError((err) => {
          this.errorHandler.handleHttpError(err, 'AbsenceService.notifyHR').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Benachrichtigen der HR');
          });
          return of(null);
        })
      );
  }

  // ===== HR FUNCTIONS =====

  /** Lade HR-Übersicht */
  loadHRReview(): Observable<Absence[]> {
    return this.http.get<Absence[]>(`${this.baseUrl}/absences/hr_review/`)
      .pipe(
        catchError((err) => {
          this.error.set('Fehler beim Laden der HR-Übersicht');
          return of([]);
        })
      );
  }

  // ===== ENHANCED WORKFLOW METHODS =====

  /** Lade Urlaubsübersicht für aktuellen Benutzer */
  loadVacationSummary(): Observable<VacationSummary> {
    return this.http.get<VacationSummary>(`${this.baseUrl}/absences/my_vacation_summary/`)
      .pipe(
        catchError((err) => {
          this.error.set('Fehler beim Laden der Urlaubsübersicht');
          console.error('Vacation summary error:', err);
          return of({
            vacation_entitlement: 0,
            carryover_vacation: 0,
            vacation_year: new Date().getFullYear(),
            used_vacation_days: 0,
            remaining_vacation_days: 0,
            total_entitlement: 0
          });
        })
      );
  }

  /** HR: Abwesenheit als bearbeitet markieren */
  processAbsenceByHR(id: number, comment?: string): Observable<Absence> {
    return this.http.post<Absence>(`${this.baseUrl}/absences/${id}/hr_process/`, { comment })
      .pipe(
        tap((processed) => {
          this._updateAbsenceInLists(processed);
          this.notificationService.notifySuccess('Abwesenheit als bearbeitet markiert');
        }),
        catchError((err) => {
          this.error.set('Fehler bei HR-Bearbeitung');
          this.notificationService.notifyError('Fehler bei der HR-Bearbeitung');
          throw err;
        })
      );
  }

  /** Überarbeitete Version einer Abwesenheit erstellen */
  createRevision(originalId: number, revisionData: RevisionRequest): Observable<Absence> {
    return this.http.post<Absence>(`${this.baseUrl}/absences/${originalId}/create_revision/`, revisionData)
      .pipe(
        tap((revision) => {
          this.absences.update(absences => [revision, ...absences]);
          this.notificationService.notifySuccess('Überarbeitete Abwesenheit erstellt');
        }),
        catchError((err) => {
          this.error.set('Fehler beim Erstellen der Revision');
          this.notificationService.notifyError('Fehler beim Erstellen der überarbeiteten Version');
          throw err;
        })
      );
  }

  /** Kommentar zu Abwesenheit hinzufügen */
  addComment(absenceId: number, commentData: CommentRequest): Observable<AbsenceComment> {
    return this.http.post<AbsenceComment>(`${this.baseUrl}/absences/${absenceId}/add_comment/`, commentData)
      .pipe(
        tap((comment) => {
          // Reload all absences to get updated comments
          this.loadMyAbsences();
          this.notificationService.notifySuccess('Kommentar hinzugefügt');
        }),
        catchError((err) => {
          this.error.set('Fehler beim Hinzufügen des Kommentars');
          this.notificationService.notifyError('Fehler beim Hinzufügen des Kommentars');
          throw err;
        })
      );
  }

  /** Kommentare für eine Abwesenheit laden */
  getComments(absenceId: number): Observable<AbsenceComment[]> {
    return this.http.get<AbsenceComment[]>(`${this.baseUrl}/absences/${absenceId}/comments/`)
      .pipe(
        catchError((err) => {
          this.error.set('Fehler beim Laden der Kommentare');
          this.notificationService.notifyError('Fehler beim Laden der Kommentare');
          return of([]);
        })
      );
  }

  /** Prüfe Urlaubsanspruch vor Antragstellung */
  checkVacationEntitlement(startDate: string, endDate: string): Observable<{canTake: boolean, required: number, available: number}> {
    const workdays = this.calculateWorkingDays(startDate, endDate);
    
    return this.loadVacationSummary().pipe(
      map(summary => ({
        canTake: summary.remaining_vacation_days >= workdays,
        required: workdays,
        available: summary.remaining_vacation_days
      }))
    );
  }

  // ===== UTILITY METHODS =====

  /** Aktualisiere Abwesenheit in allen Listen */
  private _updateAbsenceInLists(updated: Absence): void {
    this.absences.update((list) =>
      list.map((a) => (a.id === updated.id ? updated : a))
    );
    
    this.pendingApprovals.update((list) =>
      list.filter((a) => a.id !== updated.id)
    );
  }

  /** Berechne Arbeitstage zwischen zwei Daten */
  calculateWorkingDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Nicht Sonntag oder Samstag
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  }

  /** Prüfe ob Datum in der Zukunft liegt */
  isFutureDate(date: string): boolean {
    return new Date(date) > new Date();
  }

  /** Formatiere Absence Status für UI */
  getStatusColor(status: string): string {
    const colors = {
      'pending': 'warning',
      'approved': 'success', 
      'rejected': 'danger',
      'hr_notified': 'primary',
      'cancelled': 'medium'
    };
    return colors[status as keyof typeof colors] || 'medium';
  }

  /** Legacy Methoden für Rückwärtskompatibilität */
  load(year?: number): void {
    this.loadMyAbsences(year);
  }

  create(absence: Partial<Absence>): void {
    const request: AbsenceCreateRequest = {
      absence_type_id: absence.absence_type_id!,
      start_date: absence.start_date!,
      end_date: absence.end_date!,
      reason: absence.reason,
      representative_id: absence.representative_id
    };
    
    this.createAbsence(request).subscribe();
  }

  delete(id: number): void {
    this.deleteAbsence(id).subscribe();
  }

  approve(id: number, data: { approved: boolean; approval_comment?: string }): void {
    if (data.approved) {
      this.approveAbsence(id, data.approval_comment).subscribe();
    } else {
      this.rejectAbsence(id, data.approval_comment || 'Abgelehnt').subscribe();
    }
  }

  // ===== CHAT INTEGRATION =====

  /** Genehmige Abwesenheit aus dem Chat heraus */
  approveFromChat(id: number, data: { comment?: string }): Observable<Absence> {
    return this.http.post<Absence>(`${this.baseUrl}/absences/${id}/approve_from_chat/`, data)
      .pipe(
        tap((updated: Absence) => {
          this._updateAbsenceInLists(updated);
          this.notificationService.notifySuccess(
            `Abwesenheit wurde genehmigt`
          );
        }),
        catchError((err) => {
          this.errorHandler.handleHttpError(err, 'AbsenceService.approveFromChat').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Genehmigen: ' + (err.error?.error || 'Unbekannter Fehler'));
          });
          throw err;
        })
      );
  }

  /** Lehne Abwesenheit aus dem Chat ab */
  rejectFromChat(id: number, data: { rejection_reason: string; comment?: string }): Observable<Absence> {
    return this.http.post<Absence>(`${this.baseUrl}/absences/${id}/reject_from_chat/`, data)
      .pipe(
        tap((updated: Absence) => {
          this._updateAbsenceInLists(updated);
          this.notificationService.notifySuccess(
            `Abwesenheit wurde abgelehnt`
          );
        }),
        catchError((err) => {
          this.errorHandler.handleHttpError(err, 'AbsenceService.rejectFromChat').then(appError => {
            this.error.set(appError.message);
            this.notificationService.notifyError('Fehler beim Ablehnen: ' + (err.error?.error || 'Unbekannter Fehler'));
          });
          throw err;
        })
      );
  }

  /** Hole Abwesenheit nach ID (synchron aus Signal oder async vom Server) */
  getAbsenceById(id: number): Observable<Absence> {
    // Versuche zuerst aus dem lokalen Cache
    const cached = this.absences().find(a => a.id === id);
    if (cached) {
      return of(cached);
    }
    
    // Sonst vom Server laden
    return this.loadAbsence(id);
  }

  /** Hole alle Abwesenheiten (Observable, nicht Signal) */
  getAllAbsences(): Observable<Absence[]> {
    return this.http.get<Absence[]>(`${this.baseUrl}/absences/`)
      .pipe(
        catchError((err) => {
          console.error('Fehler beim Laden aller Abwesenheiten:', err);
          return of([]);
        })
      );
  }
}
