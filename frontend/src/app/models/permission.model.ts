/**
 * Permission System Models
 * Für flexibles Permission-Mapping-System
 */

export enum PermissionCategory {
  APP = 'APP',
  WORKORDER = 'WORKORDER',
  ABSENCE = 'ABSENCE',
  USER = 'USER',
  DEPARTMENT = 'DEPARTMENT',
  ANALYTICS = 'ANALYTICS',
  ADMIN = 'ADMIN',
  OTHER = 'OTHER'
}

export enum EntityType {
  DEPARTMENT = 'DEPARTMENT',
  ROLE = 'ROLE',
  SPECIALTY = 'SPECIALTY',
  GROUP = 'GROUP'
}

export enum PermissionScope {
  NONE = 'NONE',
  OWN = 'OWN',
  DEPARTMENT = 'DEPARTMENT',
  ALL = 'ALL'
}

export interface PermissionCode {
  id: number;
  code: string;
  name: string;
  description: string;
  category: PermissionCategory;
  is_active: boolean;
  display_order: number;
  supports_scope: boolean;  // NEU
  default_scope: PermissionScope;  // NEU
  created_at: string;
  updated_at: string;
}

export interface PermissionMapping {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  permission: number; // Permission ID
  permission_detail?: PermissionCode;
  entity_display_name?: string;
  scope?: PermissionScope;  // NEU - überschreibt default_scope
  object_type?: string;
  object_id?: number;
  is_active: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PermissionsByCategory {
  [category: string]: PermissionCode[];
}

export interface BulkPermissionUpdate {
  entity_type: EntityType;
  entity_id: number;
  permission_codes: string[];
  permission_scopes?: { [permission_code: string]: PermissionScope | null };  // NEU
}

export interface EntityWithPermissions {
  id: number;
  name: string;
  code?: string;
  type: EntityType;
  permissions: PermissionCode[];
}
