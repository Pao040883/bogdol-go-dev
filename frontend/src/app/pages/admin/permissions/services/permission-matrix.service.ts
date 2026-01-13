import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

// ===== NEW PERMISSION SYSTEM INTERFACES =====

export type PermissionScope = 'NONE' | 'OWN' | 'DEPARTMENT' | 'ALL';
export type EntityType = 'DEPARTMENT' | 'ROLE' | 'SPECIALTY' | 'GROUP';

export interface PermissionCode {
  id: number;
  code: string;
  name: string;
  category: string;
  supports_scope: boolean;
  default_scope: PermissionScope;
  is_active: boolean;
}

export interface EntityInfo {
  id: number;
  name: string;
  code?: string;
  display: string;
}

export interface PermissionMapping {
  permission: PermissionCode;
  source_type: EntityType;
  source: EntityInfo;
  scope: PermissionScope | null;
  is_effective: boolean;
  mapping_id: number;
}

export interface EffectivePermission {
  code: string;
  name: string;
  category: string;
  scope: PermissionScope | null;
  sources: string[];
  supports_scope: boolean;
}

export interface PermissionFromEntity {
  code: string;
  name: string;
  scope: PermissionScope | null;
  mapping_id: number;
}

export interface DepartmentWithPermissions {
  department: {
    id: number;
    name: string;
    code: string;
  };
  role: {
    id: number;
    name: string;
    code: string;
    hierarchy_level: number;
  } | null;
  is_primary: boolean;
  permissions_from_department: PermissionFromEntity[];
  permissions_from_role: PermissionFromEntity[];
}

export interface SpecialtyWithPermissions {
  specialty: {
    id: number;
    name: string;
    code: string;
  };
  is_active: boolean;
  is_primary: boolean;
  proficiency_level: number;
  permissions_from_specialty: PermissionFromEntity[];
}

export interface GroupWithPermissions {
  group: {
    id: number;
    name: string;
  };
  permissions_from_group: PermissionFromEntity[];
}

export interface PermissionSummary {
  total_permissions: number;
  total_mappings: number;
  has_full_access: boolean;
  permissions_by_category: { [category: string]: number };
  permissions_by_scope: { [scope: string]: number };
  permissions_by_source: { [source: string]: number };
}

export interface LegacyAssignments {
  hr_assignments: {
    id: number;
    employee: {
      id: number;
      username: string;
      name: string;
    };
    department: {
      id: number;
      name: string;
      code: string;
    } | null;
    valid_from: string;
    valid_until: string | null;
  }[];
  workorder_assignments: {
    id: number;
    submitter: {
      id: number;
      username: string;
      name: string;
    };
    specialty: {
      id: number;
      name: string;
      code: string;
    };
    is_auto_assigned: boolean;
    valid_from: string;
    valid_until: string | null;
  }[];
  object_permissions: {
    model: string;
    object_id: number;
    object_repr: string;
    permissions: string[];
  }[];
}

export interface UserPermissionMatrix {
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_superuser: boolean;
    is_staff: boolean;
    is_active: boolean;
  };
  has_full_access: boolean;
  permission_mappings: PermissionMapping[];
  effective_permissions: EffectivePermission[];
  departments: DepartmentWithPermissions[];
  specialties: SpecialtyWithPermissions[];
  groups: GroupWithPermissions[];
  summary: PermissionSummary;
  legacy?: LegacyAssignments;
}

@Injectable({
  providedIn: 'root',
})
export class PermissionMatrixService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Holt die komplette Permission Matrix für einen User
   */
  getUserPermissionMatrix(userId: number): Observable<UserPermissionMatrix> {
    return this.http.get<UserPermissionMatrix>(
      `${this.apiUrl}/admin/users/${userId}/permission_matrix/`
    );
  }

  /**
   * Prüft eine spezifische Permission für einen User
   */
  checkPermission(
    userId: number,
    permission: string,
    objectId?: number
  ): Observable<{ has_permission: boolean; reason: string }> {
    const params: any = { permission };
    if (objectId) {
      params.object_id = objectId;
    }
    
    return this.http.get<{ has_permission: boolean; reason: string }>(
      `${this.apiUrl}/auth/users/${userId}/check_permission/`,
      { params }
    );
  }

  /**
   * Exportiert Permission Matrix als JSON
   */
  exportPermissionMatrix(userId: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/auth/users/${userId}/permission_matrix/?format=json`,
      { responseType: 'blob' }
    );
  }
}
