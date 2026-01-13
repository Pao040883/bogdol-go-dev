import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BadgeService } from '../../services/badge.service';
import {
  WorkOrder,
  WorkOrderClient,
  WorkObject,
  WorkOrderStatistics,
  WorkOrderFilters,
  WorkOrderTemplate,
  CreateFromTemplateRequest,
  WorkOrderHistory,
  BulkSubmitResponse,
  RecurringWorkOrderChecklist,
  BulkDownloadRequest,
  MergePdfsRequest
} from '../interfaces/workorder.types';

@Injectable({
  providedIn: 'root'
})
export class WorkOrderService {
  private readonly http = inject(HttpClient);
  private readonly badgeService = inject(BadgeService);
  private readonly baseUrl = `${environment.apiUrl}/workorders`;

  // State Signals
  readonly workOrders = signal<WorkOrder[]>([]);
  readonly clients = signal<WorkOrderClient[]>([]);
  readonly objects = signal<WorkObject[]>([]);
  readonly templates = signal<WorkOrderTemplate[]>([]);
  readonly checklistItems = signal<RecurringWorkOrderChecklist[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ===== CLIENT METHODS =====

  /** Load all clients */
  loadClients(): Observable<WorkOrderClient[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<WorkOrderClient[]>(`${this.baseUrl}/clients/`).pipe(
      tap(clients => {
        this.clients.set(clients);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.error.set('Fehler beim Laden der Kunden');
        this.isLoading.set(false);
        console.error('Load clients error:', err);
        return of([]);
      })
    );
  }

  /** Create a new client */
  createClient(client: Partial<WorkOrderClient>): Observable<WorkOrderClient> {
    return this.http.post<WorkOrderClient>(`${this.baseUrl}/clients/`, client).pipe(
      tap(newClient => {
        this.clients.update(list => [...list, newClient]);
      }),
      catchError(err => {
        this.error.set('Fehler beim Erstellen des Kunden');
        console.error('Create client error:', err);
        throw err;
      })
    );
  }

  /** Update a client */
  updateClient(id: number, client: Partial<WorkOrderClient>): Observable<WorkOrderClient> {
    return this.http.put<WorkOrderClient>(`${this.baseUrl}/clients/${id}/`, client).pipe(
      tap(updatedClient => {
        this.clients.update(list => 
          list.map(c => c.id === id ? updatedClient : c)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Aktualisieren des Kunden');
        console.error('Update client error:', err);
        throw err;
      })
    );
  }

  /** Delete a client */
  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clients/${id}/`).pipe(
      tap(() => {
        this.clients.update(list => list.filter(c => c.id !== id));
      }),
      catchError(err => {
        this.error.set('Fehler beim Löschen des Kunden');
        console.error('Delete client error:', err);
        throw err;
      })
    );
  }

  // ===== WORK OBJECT METHODS =====

  /** Load all work objects */
  loadObjects(): Observable<WorkObject[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<WorkObject[]>(`${this.baseUrl}/objects/`).pipe(
      tap(objects => {
        this.objects.set(objects);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.error.set('Fehler beim Laden der Objekte');
        this.isLoading.set(false);
        console.error('Load objects error:', err);
        return of([]);
      })
    );
  }

  /** Load objects for a specific client */
  loadObjectsByClient(clientId: number): Observable<WorkObject[]> {
    return this.http.get<WorkObject[]>(`${this.baseUrl}/objects/by_client/`, {
      params: { client_id: clientId.toString() }
    }).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden der Objekte');
        console.error('Load objects by client error:', err);
        return of([]);
      })
    );
  }

  /** Create a new work object */
  createObject(obj: Partial<WorkObject>): Observable<WorkObject> {
    return this.http.post<WorkObject>(`${this.baseUrl}/objects/`, obj).pipe(
      tap(newObject => {
        this.objects.update(list => [...list, newObject]);
      }),
      catchError(err => {
        this.error.set('Fehler beim Erstellen des Objekts');
        console.error('Create object error:', err);
        throw err;
      })
    );
  }

  /** Update a work object */
  updateObject(id: number, obj: Partial<WorkObject>): Observable<WorkObject> {
    return this.http.put<WorkObject>(`${this.baseUrl}/objects/${id}/`, obj).pipe(
      tap(updatedObject => {
        this.objects.update(list => 
          list.map(o => o.id === id ? updatedObject : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Aktualisieren des Objekts');
        console.error('Update object error:', err);
        throw err;
      })
    );
  }

  /** Delete a work object */
  deleteObject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/objects/${id}/`).pipe(
      tap(() => {
        this.objects.update(list => list.filter(o => o.id !== id));
      }),
      catchError(err => {
        this.error.set('Fehler beim Löschen des Objekts');
        console.error('Delete object error:', err);
        throw err;
      })
    );
  }

  // ===== WORK ORDER METHODS =====

  /** Load all work orders */
  loadWorkOrders(filters?: WorkOrderFilters, showAll?: boolean): Observable<WorkOrder[]> {
    this.isLoading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filters) {
      if (filters.status) params = params.set('status', filters.status);
      if (filters.client) params = params.set('client', filters.client.toString());
      if (filters.work_object) params = params.set('work_object', filters.work_object.toString());
      if (filters.assigned_to) params = params.set('assigned_to', filters.assigned_to.toString());
      if (filters.search) params = params.set('search', filters.search);
    }
    
    // Add show_all parameter if provided
    if (showAll !== undefined) {
      params = params.set('show_all', showAll.toString());
    }

    return this.http.get<WorkOrder[]>(`${this.baseUrl}/orders/`, { params }).pipe(
      tap(orders => {
        this.workOrders.set(orders);
        this.updateBadgeCount();
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.error.set('Fehler beim Laden der Arbeitsscheine');
        this.isLoading.set(false);
        console.error('Load work orders error:', err);
        return of([]);
      })
    );
  }

  /** Load work orders assigned to current user */
  loadMyOrders(statusFilter?: string): Observable<WorkOrder[]> {
    let params = new HttpParams();
    if (statusFilter) {
      params = params.set('status', statusFilter);
    }

    return this.http.get<WorkOrder[]>(`${this.baseUrl}/orders/my_orders/`, { params }).pipe(
      tap(orders => {
        this.workOrders.set(orders);
      }),
      catchError(err => {
        this.error.set('Fehler beim Laden der Arbeitsscheine');
        console.error('Load my orders error:', err);
        return of([]);
      })
    );
  }

  /** Get a single work order */
  getWorkOrder(id: number): Observable<WorkOrder> {
    return this.http.get<WorkOrder>(`${this.baseUrl}/orders/${id}/`).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden des Arbeitsscheins');
        console.error('Get work order error:', err);
        throw err;
      })
    );
  }

  /** Create a new work order */
  createWorkOrder(order: Partial<WorkOrder>): Observable<WorkOrder> {
    return this.http.post<WorkOrder>(`${this.baseUrl}/orders/`, order).pipe(
      tap(newOrder => {
        this.workOrders.update(list => [newOrder, ...list]);
      }),
      catchError(err => {
        this.error.set('Fehler beim Erstellen des Arbeitsscheins');
        console.error('Create work order error:', err);
        throw err;
      })
    );
  }

  /** Update a work order */
  updateWorkOrder(id: number, order: Partial<WorkOrder>): Observable<WorkOrder> {
    return this.http.put<WorkOrder>(`${this.baseUrl}/orders/${id}/`, order).pipe(
      tap(updatedOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? updatedOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Aktualisieren des Arbeitsscheins');
        console.error('Update work order error:', err);
        throw err;
      })
    );
  }

  /** Cancel a work order (only creator) */
  cancelWorkOrder(id: number): Observable<WorkOrder> {
    return this.http.post<{ message: string; work_order: WorkOrder }>(
      `${this.baseUrl}/orders/${id}/cancel/`, 
      {}
    ).pipe(
      map(response => response.work_order),
      tap(cancelledOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? cancelledOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Stornieren des Arbeitsscheins');
        console.error('Cancel work order error:', err);
        throw err;
      })
    );
  }

  /** Sign a work order with customer signature */
  signWorkOrder(id: number, signatureData: string): Observable<WorkOrder> {
    return this.http.post<{ work_order: WorkOrder }>(
      `${this.baseUrl}/orders/${id}/sign/`,
      { signature_data: signatureData }
    ).pipe(
      map(response => response.work_order),
      tap(workOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? workOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Unterschreiben des Arbeitsscheins');
        console.error('Sign work order error:', err);
        throw err;
      })
    );
  }

  /** Mark work order as completed */
  completeWorkOrder(id: number): Observable<WorkOrder> {
    return this.http.post<{ work_order: WorkOrder }>(
      `${this.baseUrl}/orders/${id}/complete/`,
      {}
    ).pipe(
      map(response => response.work_order),
      tap(workOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? workOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Abschließen des Arbeitsscheins');
        console.error('Complete work order error:', err);
        throw err;
      })
    );
  }

  /** Get work order statistics */
  getStatistics(): Observable<WorkOrderStatistics> {
    return this.http.get<WorkOrderStatistics>(`${this.baseUrl}/orders/statistics/`).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden der Statistiken');
        console.error('Get statistics error:', err);
        return of({
          total: 0,
          draft: 0,
          in_progress: 0,
          completed: 0,
          signed: 0,
          invoiced: 0
        });
      })
    );
  }

  /** Generate PDF for work order */
  generatePDF(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/orders/${id}/pdf/`, {
      responseType: 'blob'
    }).pipe(
      catchError(err => {
        this.error.set('Fehler beim Generieren des PDFs');
        console.error('Generate PDF error:', err);
        throw err;
      })
    );
  }

  // ===== TEMPLATE METHODS =====

  /** Load all templates */
  loadTemplates(): Observable<WorkOrderTemplate[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    return this.http.get<WorkOrderTemplate[]>(`${this.baseUrl}/templates/`).pipe(
      tap(templates => {
        this.templates.set(templates);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.error.set('Fehler beim Laden der Vorlagen');
        this.isLoading.set(false);
        console.error('Load templates error:', err);
        return of([]);
      })
    );
  }

  /** Get a specific template */
  getTemplate(id: number): Observable<WorkOrderTemplate | null> {
    return this.http.get<WorkOrderTemplate>(`${this.baseUrl}/templates/${id}/`).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden der Vorlage');
        console.error('Get template error:', err);
        return of(null);
      })
    );
  }

  /** Create a new template */
  createTemplate(template: Partial<WorkOrderTemplate>): Observable<WorkOrderTemplate> {
    return this.http.post<WorkOrderTemplate>(`${this.baseUrl}/templates/`, template).pipe(
      tap(newTemplate => {
        this.templates.update(list => [...list, newTemplate]);
      }),
      catchError(err => {
        this.error.set('Fehler beim Erstellen der Vorlage');
        console.error('Create template error:', err);
        throw err;
      })
    );
  }

  /** Update a template */
  updateTemplate(id: number, template: Partial<WorkOrderTemplate>): Observable<WorkOrderTemplate> {
    return this.http.put<WorkOrderTemplate>(`${this.baseUrl}/templates/${id}/`, template).pipe(
      tap(updatedTemplate => {
        this.templates.update(list => 
          list.map(t => t.id === id ? updatedTemplate : t)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Aktualisieren der Vorlage');
        console.error('Update template error:', err);
        throw err;
      })
    );
  }

  /** Delete a template */
  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/templates/${id}/`).pipe(
      tap(() => {
        this.templates.update(list => list.filter(t => t.id !== id));
      }),
      catchError(err => {
        this.error.set('Fehler beim Löschen der Vorlage');
        console.error('Delete template error:', err);
        throw err;
      })
    );
  }

  /** Create work order from template */
  createFromTemplate(request: CreateFromTemplateRequest): Observable<WorkOrder> {
    return this.http.post<{ work_order: WorkOrder }>(
      `${this.baseUrl}/templates/${request.template_id}/create_work_order/`,
      request
    ).pipe(
      map(response => response.work_order),
      tap(workOrder => {
        this.workOrders.update(list => [workOrder, ...list]);
      }),
      catchError(err => {
        this.error.set('Fehler beim Erstellen des Arbeitsscheins aus Vorlage');
        console.error('Create from template error:', err);
        throw err;
      })
    );
  }

  // ===== BILLING WORKFLOW METHODS =====

  /** Check if work order with these O/P numbers already exists (duplicate check after OCR) */
  checkDuplicate(objectNumber: string, projectNumber: string): Observable<{
    isDuplicate: boolean;
    existingOrder: string;
    contentHash: string;
    message: string;
  }> {
    return this.http.post<{
      isDuplicate: boolean;
      existingOrder: string;
      contentHash: string;
      message: string;
    }>(`${this.baseUrl}/orders/check_duplicate/`, {
      object_number: objectNumber,
      project_number: projectNumber
    }).pipe(
      catchError(err => {
        console.error('Duplicate check error:', err);
        // Bei Fehler: Als kein Duplikat behandeln (fail-safe)
        return of({
          isDuplicate: false,
          existingOrder: '',
          contentHash: '',
          message: 'Duplikat-Check fehlgeschlagen'
        });
      })
    );
  }

  /** Bulk submit scanned documents with individual O/P numbers */
  bulkSubmitScansWithNumbers(scans: { file: File; objectNumber: string; projectNumber: string; leistungsmonat?: string; leistungsmonat_confidence?: number | null }[]): Observable<BulkSubmitResponse> {
    const formData = new FormData();
    
    scans.forEach((scan, index) => {
      formData.append('scanned_documents', scan.file);
      formData.append(`object_numbers[${index}]`, scan.objectNumber);
      formData.append(`project_numbers[${index}]`, scan.projectNumber);
      if (scan.leistungsmonat) {
        formData.append(`leistungsmonate[${index}]`, scan.leistungsmonat);
      }
      if (scan.leistungsmonat_confidence !== undefined && scan.leistungsmonat_confidence !== null) {
        formData.append(`leistungsmonat_confidences[${index}]`, scan.leistungsmonat_confidence.toString());
      } else {
        formData.append(`leistungsmonat_confidences[${index}]`, 'null');
      }
    });
    
    return this.http.post<BulkSubmitResponse>(
      `${this.baseUrl}/orders/bulk_submit/`,
      formData
    ).pipe(
      tap(response => {
        // Reload work orders to get the newly created ones
        this.loadWorkOrders().subscribe();
      }),
      catchError(err => {
        this.error.set('Fehler beim Hochladen der Scans');
        console.error('Bulk submit error:', err);
        throw err;
      })
    );
  }

  /** Bulk upload scanned work orders (legacy method) */
  bulkSubmitScans(files: File[], clientId?: number, projectNumber?: string, objectNumber?: string): Observable<BulkSubmitResponse> {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('scanned_documents', file);
    });
    
    if (clientId) {
      formData.append('client_id', clientId.toString());
    }
    
    if (projectNumber) {
      formData.append('project_number', projectNumber);
    }
    
    if (objectNumber) {
      formData.append('object_number', objectNumber);
    }
    
    return this.http.post<BulkSubmitResponse>(
      `${this.baseUrl}/orders/bulk_submit/`,
      formData
    ).pipe(
      tap(response => {
        // Reload work orders to get the newly created ones
        this.loadWorkOrders().subscribe();
      }),
      catchError(err => {
        this.error.set('Fehler beim Hochladen der Scans');
        console.error('Bulk submit error:', err);
        throw err;
      })
    );
  }

  /** Mark work order as billed */
  markAsBilled(id: number): Observable<WorkOrder> {
    return this.http.post<{ work_order: WorkOrder }>(
      `${this.baseUrl}/orders/${id}/mark_billed/`,
      {}
    ).pipe(
      map(response => response.work_order),
      tap(workOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? workOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Markieren als abgerechnet');
        console.error('Mark as billed error:', err);
        throw err;
      })
    );
  }
  /** Submit work order for billing */
  submitWorkOrder(id: number): Observable<WorkOrder> {
    return this.http.post<{ work_order: WorkOrder }>(
      `${this.baseUrl}/orders/${id}/submit/`,
      {}
    ).pipe(
      map(response => response.work_order),
      tap(workOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? workOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Einreichen');
        console.error('Submit work order error:', err);
        throw err;
      })
    );
  }

  /** Get submitted work orders (for billing staff) */
  getSubmittedWorkOrders(): Observable<WorkOrder[]> {
    return this.http.get<WorkOrder[]>(`${this.baseUrl}/orders/submitted/`).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden der eingereichten Arbeitsscheine');
        console.error('Get submitted work orders error:', err);
        return of([]);
      })
    );
  }

  /** Get work order history */
  getWorkOrderHistory(id: number): Observable<WorkOrderHistory[]> {
    return this.http.get<WorkOrderHistory[]>(`${this.baseUrl}/orders/${id}/history/`).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden der Historie');
        console.error('Get work order history error:', err);
        return of([]);
      })
    );
  }

  // ===== DUPLIKAT & DOWNLOAD TRACKING =====

  /** Check for duplicates of existing work order (legacy) */
  checkDuplicateById(id: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${id}/check_duplicate/`, {}).pipe(
      catchError(err => {
        this.error.set('Fehler beim Duplikat-Check');
        console.error('Check duplicate error:', err);
        throw err;
      })
    );
  }

  /** Mark PDF as downloaded */
  markDownloaded(id: number): Observable<WorkOrder> {
    return this.http.post<{ work_order: WorkOrder }>(
      `${this.baseUrl}/orders/${id}/mark_downloaded/`,
      {}
    ).pipe(
      map(response => response.work_order),
      tap(workOrder => {
        this.workOrders.update(list => 
          list.map(o => o.id === id ? workOrder : o)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Markieren als heruntergeladen');
        console.error('Mark downloaded error:', err);
        throw err;
      })
    );
  }

  /** Bulk mark as downloaded */
  bulkMarkDownloaded(workorderIds: number[]): Observable<any> {
    const payload: BulkDownloadRequest = { workorder_ids: workorderIds };
    return this.http.post<any>(`${this.baseUrl}/orders/bulk_download/`, payload).pipe(
      tap(() => {
        // Reload to get updated download status
        this.loadWorkOrders().subscribe();
      }),
      catchError(err => {
        this.error.set('Fehler beim Bulk-Download-Markierung');
        console.error('Bulk download error:', err);
        throw err;
      })
    );
  }

  /** Bulk mark as billed */
  bulkMarkBilled(workorderIds: number[]): Observable<{message: string, updated_count: number, errors?: string[]}> {
    const payload = { workorder_ids: workorderIds };
    return this.http.post<any>(`${this.baseUrl}/orders/bulk_mark_billed/`, payload).pipe(
      tap(() => {
        // Reload to get updated status
        this.loadWorkOrders().subscribe();
      }),
      catchError(err => {
        this.error.set('Fehler beim Bulk-Abrechnen');
        console.error('Bulk mark billed error:', err);
        throw err;
      })
    );
  }

  /** Merge PDFs for SR-Rechnung */
  mergePdfs(workorderIds: number[], srNumber?: string): Observable<Blob> {
    const payload: MergePdfsRequest = { 
      workorder_ids: workorderIds,
      sr_number: srNumber
    };
    return this.http.post(`${this.baseUrl}/orders/merge_pdfs/`, payload, {
      responseType: 'blob'
    }).pipe(
      tap(() => {
        // Automatically mark as downloaded
        this.bulkMarkDownloaded(workorderIds).subscribe();
      }),
      catchError(err => {
        this.error.set('Fehler beim Zusammenführen der PDFs');
        console.error('Merge PDFs error:', err);
        throw err;
      })
    );
  }

  /** Split multi-page PDF into individual pages */
  splitPdf(file: File): Observable<{ pages: Array<{ page_number: number; url: string }> }> {
    const formData = new FormData();
    formData.append('pdf', file);
    
    return this.http.post<{ pages: Array<{ page_number: number; url: string }> }>(
      `${this.baseUrl}/orders/split_pdf/`,
      formData
    ).pipe(
      catchError(err => {
        this.error.set('Fehler beim Aufteilen der PDF');
        console.error('Split PDF error:', err);
        throw err;
      })
    );
  }

  // ===== HAKLISTE (CHECKLIST) METHODS =====

  /** Load all checklist items */
  loadChecklistItems(isActive?: boolean, showAll?: boolean): Observable<RecurringWorkOrderChecklist[]> {
    this.isLoading.set(true);
    this.error.set(null);
    
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('is_active', String(isActive));
    }
    if (showAll !== undefined) {
      params = params.set('show_all', String(showAll));
    }
    
    return this.http.get<RecurringWorkOrderChecklist[]>(`${this.baseUrl}/checklist/`, { params }).pipe(
      tap(items => {
        this.checklistItems.set(items);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.error.set('Fehler beim Laden der Hakliste');
        this.isLoading.set(false);
        console.error('Load checklist error:', err);
        return of([]);
      })
    );
  }

  /** Get unchecked checklist items for current month */
  getUncheckedChecklistItems(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/checklist/unchecked/`).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden nicht abgehakter Einträge');
        console.error('Get unchecked error:', err);
        return of({ items: [], count: 0 });
      })
    );
  }

  /** Get checklist items by SR number */
  getChecklistItemsBySrNumber(srNumber: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/checklist/by_sr_number/`, {
      params: { sr_number: srNumber }
    }).pipe(
      catchError(err => {
        this.error.set('Fehler beim Laden der SR-Einträge');
        console.error('Get by SR error:', err);
        return of({ items: [], count: 0 });
      })
    );
  }

  /** Create checklist item */
  createChecklistItem(item: Partial<RecurringWorkOrderChecklist>): Observable<RecurringWorkOrderChecklist> {
    return this.http.post<RecurringWorkOrderChecklist>(`${this.baseUrl}/checklist/`, item).pipe(
      tap(newItem => {
        this.checklistItems.update(list => [...list, newItem]);
      }),
      catchError(err => {
        this.error.set('Fehler beim Erstellen des Eintrags');
        console.error('Create checklist error:', err);
        throw err;
      })
    );
  }

  /** Update checklist item */
  updateChecklistItem(id: number, item: Partial<RecurringWorkOrderChecklist>): Observable<RecurringWorkOrderChecklist> {
    return this.http.put<RecurringWorkOrderChecklist>(`${this.baseUrl}/checklist/${id}/`, item).pipe(
      tap(updatedItem => {
        this.checklistItems.update(list => 
          list.map(i => i.id === id ? updatedItem : i)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Aktualisieren');
        console.error('Update checklist error:', err);
        throw err;
      })
    );
  }

  /** Delete checklist item */
  deleteChecklistItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/checklist/${id}/`).pipe(
      tap(() => {
        this.checklistItems.update(list => list.filter(i => i.id !== id));
      }),
      catchError(err => {
        this.error.set('Fehler beim Löschen');
        console.error('Delete checklist error:', err);
        throw err;
      })
    );
  }

  /** Check (mark) checklist item for current month */
  checkChecklistItem(id: number): Observable<RecurringWorkOrderChecklist> {
    return this.http.post<{ checklist_item: RecurringWorkOrderChecklist }>(
      `${this.baseUrl}/checklist/${id}/check/`,
      {}
    ).pipe(
      map(response => response.checklist_item),
      tap(item => {
        this.checklistItems.update(list => 
          list.map(i => i.id === id ? item : i)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Abhaken');
        console.error('Check checklist error:', err);
        throw err;
      })
    );
  }

  /** Uncheck checklist item */
  uncheckChecklistItem(id: number): Observable<RecurringWorkOrderChecklist> {
    return this.http.post<{ checklist_item: RecurringWorkOrderChecklist }>(
      `${this.baseUrl}/checklist/${id}/uncheck/`,
      {}
    ).pipe(
      map(response => response.checklist_item),
      tap(item => {
        this.checklistItems.update(list => 
          list.map(i => i.id === id ? item : i)
        );
      }),
      catchError(err => {
        this.error.set('Fehler beim Entfernen des Häkchens');
        console.error('Uncheck checklist error:', err);
        throw err;
      })
    );
  }

  /** Synchronize checklist with master data */
  syncChecklistItems(): Observable<{ message: string; task_id: string }> {
    return this.http.post<{ message: string; task_id: string }>(
      `${this.baseUrl}/checklist/sync/`,
      {}
    ).pipe(
      catchError(err => {
        this.error.set('Fehler bei der Synchronisation');
        console.error('Sync checklist error:', err);
        throw err;
      })
    );
  }

  /** Import preview - analyze Excel/CSV file */
  checklistImportPreview(formData: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/checklist/import_preview/`,
      formData
    ).pipe(
      catchError(err => {
        this.error.set('Fehler beim Lesen der Datei');
        console.error('Import preview error:', err);
        throw err;
      })
    );
  }

  /** Import execute - validate imported data with column mapping */
  checklistImportExecute(formData: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/checklist/import_execute/`,
      formData
    ).pipe(
      catchError(err => {
        this.error.set('Fehler beim Import');
        console.error('Import execute error:', err);
        throw err;
      })
    );
  }

  /** Import save - save validated data to database */
  checklistImportSave(items: any[]): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/checklist/import_save/`,
      { items }
    ).pipe(
      tap(() => {
        // Reload checklist after import
        this.loadChecklistItems().subscribe();
      }),
      catchError(err => {
        this.error.set('Fehler beim Speichern');
        console.error('Import save error:', err);
        throw err;
      })
    );
  }

  // ===== BADGE MANAGEMENT =====

  /**
   * Lädt Badge-Counts für Arbeitsscheine beim App-Start
   * Ruft beide Stati parallel ab und berechnet Gesamtanzahl
   */
  loadBadgeCounts(): Observable<void> {
    return forkJoin({
      completed: this.http.get<WorkOrder[]>(`${this.baseUrl}/orders/`, { 
        params: new HttpParams().set('status', 'completed') 
      }),
      submitted: this.http.get<WorkOrder[]>(`${this.baseUrl}/orders/`, { 
        params: new HttpParams().set('status', 'submitted') 
      })
    }).pipe(
      tap(({ completed, submitted }) => {
        // Filtere completed: nur die, die noch nicht submitted sind
        const openCount = completed.filter(wo => !wo.submitted_at).length;
        const billingCount = submitted.length;
        const totalCount = openCount + billingCount;
        
        this.badgeService.setBadge('arbeitsscheine', totalCount);
        console.log(`📊 Arbeitsschein-Badges: ${openCount} offen + ${billingCount} zur Abrechnung = ${totalCount}`);
      }),
      map(() => void 0),
      catchError(err => {
        console.error('Fehler beim Laden der Arbeitsschein-Badge-Counts:', err);
        return of(void 0);
      })
    );
  }

  /**
   * Aktualisiert Badge-Count basierend auf aktuell geladenen Arbeitsscheinen
   */
  private updateBadgeCount(): void {
    const orders = this.workOrders();
    const openCount = orders.filter(wo => wo.status === 'completed' && !wo.submitted_at).length;
    const billingCount = orders.filter(wo => wo.status === 'submitted').length;
    const totalCount = openCount + billingCount;
    
    this.badgeService.setBadge('arbeitsscheine', totalCount);
  }

}
