import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface AuditLogEntry {
  id?: string;
  userId: number;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string | number;
  details?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

export interface AuditFilter {
  userId?: number;
  action?: string;
  resource?: string;
  dateFrom?: Date;
  dateTo?: Date;
  success?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private readonly endpoint = `${environment.apiUrl}/audit/`;
  private _auditLogs = signal<AuditLogEntry[]>([]);
  
  readonly auditLogs$ = this._auditLogs.asReadonly();

  /**
   * Protokolliert eine Benutzeraktion
   */
  async logAction(
    action: string,
    resource: string,
    resourceId?: string | number,
    details?: any,
    success: boolean = true
  ): Promise<void> {
    const user = this.authService.activeUser();
    if (!user) return;

    const logEntry: AuditLogEntry = {
      userId: user.id,
      userEmail: user.email,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date(),
      success,
      userAgent: navigator.userAgent
    };

    try {
      // Lokales Logging für Entwicklung
      console.log('Audit Log:', logEntry);
      
      // An Backend senden (falls Endpunkt existiert)
      if (environment.production) {
        await this.http.post(this.endpoint, logEntry).toPromise();
      }
      
      // Lokal speichern für Anzeige
      this._auditLogs.update(logs => [logEntry, ...logs.slice(0, 999)]); // Max 1000 Einträge
      
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  /**
   * Spezielle Methoden für häufige Aktionen
   */
  async logLogin(success: boolean, details?: any): Promise<void> {
    await this.logAction('LOGIN', 'AUTH', undefined, details, success);
  }

  async logLogout(): Promise<void> {
    await this.logAction('LOGOUT', 'AUTH', undefined, undefined, true);
  }

  async logAbsenceCreated(absenceId: number, absenceData: any): Promise<void> {
    await this.logAction('CREATE', 'ABSENCE', absenceId, absenceData);
  }

  async logAbsenceApproved(absenceId: number, approved: boolean, comment?: string): Promise<void> {
    await this.logAction(
      approved ? 'APPROVE' : 'REJECT', 
      'ABSENCE', 
      absenceId, 
      { approved, comment }
    );
  }

  async logSofortmeldungCreated(meldungId: number, meldungData: any): Promise<void> {
    await this.logAction('CREATE', 'SOFORTMELDUNG', meldungId, meldungData);
  }

  async logReportViewed(reportType: string, filters?: any): Promise<void> {
    await this.logAction('VIEW', 'REPORT', reportType, filters);
  }

  async logDataExport(exportType: string, recordCount: number): Promise<void> {
    await this.logAction('EXPORT', 'DATA', exportType, { recordCount });
  }

  async logPermissionChange(targetUserId: number, oldPermissions: string[], newPermissions: string[]): Promise<void> {
    await this.logAction('PERMISSION_CHANGE', 'USER', targetUserId, {
      oldPermissions,
      newPermissions
    });
  }

  async logError(error: any, context?: string): Promise<void> {
    await this.logAction('ERROR', 'SYSTEM', undefined, {
      error: error.message || error,
      context,
      stack: error.stack
    }, false);
  }

  /**
   * Lädt Audit-Logs mit Filterung
   */
  async loadAuditLogs(filter?: AuditFilter): Promise<void> {
    try {
      if (environment.production) {
        const params = this.buildFilterParams(filter);
        const logs = await this.http.get<AuditLogEntry[]>(this.endpoint, { params }).toPromise();
        this._auditLogs.set(logs || []);
      } else {
        // In Entwicklung: Zeige lokale Logs
        console.log('Current audit logs:', this._auditLogs());
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  }

  /**
   * Exportiert Audit-Logs als CSV
   */
  exportAuditLogs(filter?: AuditFilter): void {
    const logs = this._auditLogs().filter(log => this.matchesFilter(log, filter));
    const csv = this.convertToCSV(logs);
    this.downloadCSV(csv, `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    
    this.logDataExport('AUDIT_LOGS', logs.length);
  }

  private buildFilterParams(filter?: AuditFilter): any {
    if (!filter) return {};
    
    const params: any = {};
    if (filter.userId) params.userId = filter.userId.toString();
    if (filter.action) params.action = filter.action;
    if (filter.resource) params.resource = filter.resource;
    if (filter.dateFrom) params.dateFrom = filter.dateFrom.toISOString();
    if (filter.dateTo) params.dateTo = filter.dateTo.toISOString();
    if (filter.success !== undefined) params.success = filter.success.toString();
    
    return params;
  }

  private matchesFilter(log: AuditLogEntry, filter?: AuditFilter): boolean {
    if (!filter) return true;
    
    if (filter.userId && log.userId !== filter.userId) return false;
    if (filter.action && log.action !== filter.action) return false;
    if (filter.resource && log.resource !== filter.resource) return false;
    if (filter.success !== undefined && log.success !== filter.success) return false;
    if (filter.dateFrom && log.timestamp < filter.dateFrom) return false;
    if (filter.dateTo && log.timestamp > filter.dateTo) return false;
    
    return true;
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'Success', 'Details'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.userEmail,
      log.action,
      log.resource,
      log.resourceId?.toString() || '',
      log.success.toString(),
      JSON.stringify(log.details || {})
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

  /**
   * Bereinigt alte Logs (nur lokal, Backend sollte eigene Retention haben)
   */
  cleanupOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    this._auditLogs.update(logs =>
      logs.filter(log => log.timestamp >= cutoffDate)
    );
  }
}
