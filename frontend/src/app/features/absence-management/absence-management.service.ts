import { Injectable, inject, signal, computed } from '@angular/core';
import { AbsenceService } from '../../core/services/absence.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuditService } from '../../core/services/audit.service';
import { Absence } from '../../core/interfaces/absence.types';

export interface AbsenceFilter {
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  dateFrom?: Date;
  dateTo?: Date;
  userId?: number;
}

export interface AbsenceStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  currentMonth: number;
}

@Injectable({ providedIn: 'root' })
export class AbsenceManagementService {
  private absenceService = inject(AbsenceService);
  private notificationService = inject(NotificationService);
  private auditService = inject(AuditService);

  private _filter = signal<AbsenceFilter>({ status: 'all' });
  
  // Computed properties für bessere Performance
  readonly filter$ = this._filter.asReadonly();
  readonly absences$ = this.absenceService.absences;
  readonly pendingApprovals$ = this.absenceService.pendingApprovals;
  readonly isLoading$ = this.absenceService.isLoading;
  readonly error$ = this.absenceService.error;

  // Filtered absences basierend auf aktuellen Filter
  readonly filteredAbsences$ = computed(() => {
    const absences = this.absences$();
    const filter = this.filter$();
    
    return absences.filter(absence => {
      // Status Filter
      if (filter.status && filter.status !== 'all') {
        const status = this.getAbsenceStatus(absence);
        if (status !== filter.status) return false;
      }
      
      // Date Range Filter
      if (filter.dateFrom && new Date(absence.start_date!) < filter.dateFrom) return false;
      if (filter.dateTo && new Date(absence.end_date!) > filter.dateTo) return false;
      
      // User Filter (Kommentiert aus da User Interface fehlt)
      // if (filter.userId && absence.user?.id !== filter.userId) return false;
      
      return true;
    });
  });

  // Statistiken
  readonly stats$ = computed((): AbsenceStats => {
    const absences = this.absences$();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return {
      total: absences.length,
      pending: absences.filter(a => this.getAbsenceStatus(a) === 'pending').length,
      approved: absences.filter(a => this.getAbsenceStatus(a) === 'approved').length,
      rejected: absences.filter(a => this.getAbsenceStatus(a) === 'rejected').length,
      currentMonth: absences.filter(a => {
        const startDate = new Date(a.start_date!);
        return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
      }).length
    };
  });

  /**
   * Erweiterte Erstellung mit Validierung und Audit
   */
  async createAbsence(absenceData: Partial<Absence>): Promise<boolean> {
    try {
      // Validierung
      const validation = this.validateAbsence(absenceData);
      if (!validation.isValid) {
        this.notificationService.notifyError(validation.message);
        return false;
      }

      // Überschneidungen prüfen
      if (await this.checkOverlaps(absenceData)) {
        const confirmed = await this.notificationService.showConfirmation(
          'Überschneidung erkannt',
          'Es gibt bereits einen Urlaubsantrag in diesem Zeitraum. Trotzdem fortfahren?'
        );
        if (!confirmed) return false;
      }

      // Erstellen
      this.absenceService.create(absenceData);
      
      // Audit Log
      await this.auditService.logAbsenceCreated(0, absenceData); // ID wird später gesetzt
      
      return true;
    } catch (error) {
      this.notificationService.notifyError('Fehler beim Erstellen des Urlaubsantrags');
      return false;
    }
  }

  /**
   * Erweiterte Genehmigung mit Workflow
   */
  async approveAbsence(id: number, approved: boolean, comment?: string): Promise<boolean> {
    try {
      // Workflow-Logik
      const absence = this.absences$().find(a => a.id === id);
      if (!absence) {
        this.notificationService.notifyError('Urlaubsantrag nicht gefunden');
        return false;
      }

      // Berechtigung prüfen (könnte auch im Guard gemacht werden)
      // if (!this.canApprove(absence)) {
      //   this.notificationService.notifyError('Keine Berechtigung für diese Aktion');
      //   return false;
      // }

      this.absenceService.approve(id, { approved, approval_comment: comment });
      
      // Audit Log
      await this.auditService.logAbsenceApproved(id, approved, comment);
      
      // Benachrichtigung an Antragsteller (später implementieren)
      // await this.notifyUser(absence.user.id, approved, comment);
      
      return true;
    } catch (error) {
      this.notificationService.notifyError('Fehler beim Genehmigen des Antrags');
      return false;
    }
  }

  /**
   * Filter setzen
   */
  setFilter(filter: Partial<AbsenceFilter>): void {
    this._filter.update(current => ({ ...current, ...filter }));
  }

  /**
   * Filter zurücksetzen
   */
  resetFilter(): void {
    this._filter.set({ status: 'all' });
  }

  /**
   * Export zu CSV
   */
  async exportAbsences(filtered: boolean = true): Promise<void> {
    const absences = filtered ? this.filteredAbsences$() : this.absences$();
    const csv = this.convertAbsencesToCSV(absences);
    this.downloadCSV(csv, `absences-${new Date().toISOString().split('T')[0]}.csv`);
    
    await this.auditService.logDataExport('ABSENCES', absences.length);
  }

  /**
   * Bulk-Operationen
   */
  async bulkApprove(absenceIds: number[], approved: boolean): Promise<void> {
    for (const id of absenceIds) {
      await this.approveAbsence(id, approved, 'Bulk-Operation');
    }
    
    this.notificationService.notifySuccess(
      `${absenceIds.length} Anträge ${approved ? 'genehmigt' : 'abgelehnt'}`
    );
  }

  // Private Helper Methods
  private getAbsenceStatus(absence: Absence): 'pending' | 'approved' | 'rejected' {
    if (absence.approved === null || absence.approved === undefined) return 'pending';
    return absence.approved ? 'approved' : 'rejected';
  }

  private validateAbsence(absence: Partial<Absence>): { isValid: boolean; message: string } {
    if (!absence.start_date) {
      return { isValid: false, message: 'Startdatum ist erforderlich' };
    }
    
    if (!absence.end_date) {
      return { isValid: false, message: 'Enddatum ist erforderlich' };
    }
    
    if (new Date(absence.start_date) > new Date(absence.end_date)) {
      return { isValid: false, message: 'Startdatum muss vor Enddatum liegen' };
    }
    
    if (new Date(absence.start_date) < new Date()) {
      return { isValid: false, message: 'Startdatum darf nicht in der Vergangenheit liegen' };
    }
    
    return { isValid: true, message: 'OK' };
  }

  private async checkOverlaps(newAbsence: Partial<Absence>): Promise<boolean> {
    const existingAbsences = this.absences$();
    const newStart = new Date(newAbsence.start_date!);
    const newEnd = new Date(newAbsence.end_date!);
    
    return existingAbsences.some(absence => {
      if (absence.approved === false) return false; // Abgelehnte ignorieren
      
      const existingStart = new Date(absence.start_date!);
      const existingEnd = new Date(absence.end_date!);
      
      return (newStart <= existingEnd && newEnd >= existingStart);
    });
  }

  private convertAbsencesToCSV(absences: Absence[]): string {
    const headers = ['ID', 'Start', 'End', 'User', 'Status', 'Reason', 'Created'];
    const rows = absences.map(absence => [
      absence.id?.toString() || '',
      absence.start_date || '',
      absence.end_date || '',
      `${absence.user?.first_name} ${absence.user?.last_name}`,
      this.getAbsenceStatus(absence),
      absence.reason || '',
      absence.created_at || ''
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
