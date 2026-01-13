import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PermissionCode,
  PermissionMapping,
  PermissionsByCategory,
  BulkPermissionUpdate,
  EntityType
} from '../models/permission.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}`;

  // Signals für State Management
  readonly permissionCodes = signal<PermissionCode[]>([]);
  readonly permissionsByCategory = signal<PermissionsByCategory>({});
  readonly isLoading = signal(false);

  /**
   * Lädt alle verfügbaren Permission Codes
   */
  loadPermissionCodes(): Observable<PermissionCode[]> {
    this.isLoading.set(true);
    return this.http.get<PermissionCode[]>(`${this.baseUrl}/permission-codes/`, { withCredentials: true }).pipe(
      tap(codes => {
        // Filtere deprecated Permissions aus
        const activeCodes = codes.filter(code => 
          !code.description?.toUpperCase().includes('DEPRECATED')
        );
        this.permissionCodes.set(activeCodes);
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Lädt Permissions gruppiert nach Kategorie
   */
  loadPermissionsByCategory(): Observable<PermissionsByCategory> {
    this.isLoading.set(true);
    return this.http.get<PermissionsByCategory>(`${this.baseUrl}/permission-codes/by_category/`, { withCredentials: true }).pipe(
      tap(grouped => {
        // Filtere deprecated Permissions aus jeder Kategorie
        const filtered: PermissionsByCategory = {};
        for (const [category, permissions] of Object.entries(grouped)) {
          filtered[category] = permissions.filter(p => 
            !p.description?.toUpperCase().includes('DEPRECATED')
          );
        }
        this.permissionsByCategory.set(filtered);
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Lädt alle Permission Mappings
   */
  loadMappings(filters?: {
    entity_type?: EntityType;
    entity_id?: number;
    is_active?: boolean;
  }): Observable<PermissionMapping[]> {
    let url = `${this.baseUrl}/permission-mappings/`;
    const params: any = {};

    if (filters?.entity_type) params.entity_type = filters.entity_type;
    if (filters?.entity_id) params.entity_id = filters.entity_id;
    if (filters?.is_active !== undefined) params.is_active = filters.is_active;

    return this.http.get<PermissionMapping[]>(url, { params, withCredentials: true });
  }

  /**
   * Lädt Permissions für eine spezifische Entity
   */
  getPermissionsForEntity(
    entityType: EntityType,
    entityId: number
  ): Observable<PermissionMapping[]> {
    return this.http.get<PermissionMapping[]>(
      `${this.baseUrl}/permission-mappings/for_entity/`,
      {
        params: {
          entity_type: entityType,
          entity_id: entityId.toString()
        },
        withCredentials: true
      }
    );
  }

  /**
   * Bulk-Update: Setzt Permissions für eine Entity
   */
  bulkUpdatePermissions(data: BulkPermissionUpdate): Observable<any> {
    return this.http.post(`${this.baseUrl}/permission-mappings/bulk_update/`, data, { withCredentials: true });
  }

  /**
   * Erstellt ein einzelnes Permission Mapping
   */
  createMapping(mapping: Partial<PermissionMapping>): Observable<PermissionMapping> {
    return this.http.post<PermissionMapping>(
      `${this.baseUrl}/permission-mappings/`,
      mapping,
      { withCredentials: true }
    );
  }

  /**
   * Aktualisiert ein Permission Mapping
   */
  updateMapping(id: number, mapping: Partial<PermissionMapping>): Observable<PermissionMapping> {
    return this.http.put<PermissionMapping>(
      `${this.baseUrl}/permission-mappings/${id}/`,
      mapping,
      { withCredentials: true }
    );
  }

  /**
   * Löscht ein Permission Mapping
   */
  deleteMapping(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/permission-mappings/${id}/`, { withCredentials: true });
  }

  /**
   * Löscht Permission-Cache
   */
  clearCache(): Observable<any> {
    return this.http.post(`${this.baseUrl}/permission-mappings/clear_cache/`, {}, { withCredentials: true });
  }

  /**
   * Extrahiert Permission-Codes aus Mappings
   */
  extractPermissionCodes(mappings: PermissionMapping[]): string[] {
    return mappings
      .filter(m => m.permission_detail)
      .map(m => m.permission_detail!.code);
  }

  /**
   * Filtert Permissions nach Kategorie
   */
  filterByCategory(category: string): PermissionCode[] {
    const allCodes = this.permissionCodes();
    return allCodes.filter(p => p.category === category);
  }
}
