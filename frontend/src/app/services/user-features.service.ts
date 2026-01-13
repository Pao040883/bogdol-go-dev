import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserFeatures {
  // Apps
  can_view_sofo: boolean;
  can_view_workorders: boolean;
  can_view_work_tickets: boolean;
  can_view_contacts: boolean;
  can_view_absences: boolean;
  
  // Workorder Permissions
  can_assign_workorders: boolean;
  can_view_workorder_checklist: boolean;
  can_manage_checklist_assignments: boolean;
  can_toggle_all_checklist_items: boolean;  // Toggle für Checkliste
  can_toggle_all_workorders: boolean;  // Toggle für Arbeitsscheine
  can_download_workorder_pdf: boolean;
  
  // Intranet
  can_view_chat: boolean;
  can_view_organigramm: boolean;
  
  // Auswertungen
  can_view_analytics: boolean;
  
  // Admin
  can_view_admin: boolean;
  can_view_users: boolean;
  can_view_companies: boolean;
  can_view_departments: boolean;
  can_view_roles: boolean;
  can_view_absence_types: boolean;
  can_view_specialties: boolean;
  can_view_ai_training: boolean;
  
  // External Links
  can_view_external_links: boolean;
  
  // Scope-Informationen (NEU)
  permission_scopes?: {
    [key: string]: 'NONE' | 'OWN' | 'DEPARTMENT' | 'ALL';
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserFeaturesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users/features/`;

  readonly features = signal<UserFeatures | null>(null);
  readonly isLoading = signal(false);

  /**
   * Lädt die Feature-Flags für den aktuellen Benutzer
   */
  loadFeatures(): Observable<UserFeatures> {
    this.isLoading.set(true);
    return this.http.get<UserFeatures>(this.baseUrl).pipe(
      tap(features => {
        this.features.set(features);
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Prüft, ob ein spezifisches Feature verfügbar ist
   */
  hasFeature(featureName: keyof Omit<UserFeatures, 'permission_scopes'>): boolean {
    const features = this.features();
    if (!features) return false;
    const value = features[featureName];
    return typeof value === 'boolean' ? value : false;
  }
  
  /**
   * Gibt den Scope einer Permission zurück
   * 
   * @param permissionCode Permission Code (z.B. 'can_view_workorders')
   * @returns Scope ('NONE' | 'OWN' | 'DEPARTMENT' | 'ALL') oder null wenn keine Permission
   */
  getPermissionScope(permissionCode: string): 'NONE' | 'OWN' | 'DEPARTMENT' | 'ALL' | null {
    const features = this.features();
    return features?.permission_scopes?.[permissionCode] ?? null;
  }
  
  /**
   * Prüft, ob User mindestens den geforderten Scope hat
   * 
   * @param permissionCode Permission Code
   * @param requiredScope Geforderter Scope
   * @returns true wenn Scope ausreichend
   */
  hasScope(permissionCode: string, requiredScope: 'OWN' | 'DEPARTMENT' | 'ALL'): boolean {
    const currentScope = this.getPermissionScope(permissionCode);
    if (!currentScope || currentScope === 'NONE') {
      return false;
    }
    
    const scopePriority = { 'ALL': 4, 'DEPARTMENT': 3, 'OWN': 2, 'NONE': 1 };
    return (scopePriority[currentScope] ?? 0) >= (scopePriority[requiredScope] ?? 0);
  }
}
