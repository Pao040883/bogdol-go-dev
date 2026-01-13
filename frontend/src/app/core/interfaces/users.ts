export interface DepartmentRole {
  department_id: number;
  department_code: string;
  role_id: number;
  role_code: string;
  hierarchy_level: number;
  is_primary: boolean;
}

export interface Users {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  // DEPRECATED - use profile instead
  company?: string;
  phone_number?: string;
  mobil_number?: string;
  is_active: boolean;
  is_staff: boolean;
  is_supervisor: boolean;
  supervisor?: number | null;
  password?: string;
  // Organization (use profile for new code)
  companies?: number[];
  department?: number | null;  // DEPRECATED - use primary_department from profile
  role?: number | null;  // DEPRECATED - use primary_role from profile
  // Legacy fields (DEPRECATED)
  job_title?: string;
  division?: string;
  // Blink Integration
  blink_id?: number | null;
  blink_company?: number | null;
  // ✅ NEW: JWT Token Fields (Phase 1A)
  groups?: string[];  // Groups aus JWT Token
  department_roles?: DepartmentRole[];  // Department-Rollen aus JWT Token
  is_bereichsleiter?: boolean;  // Schnellzugriff: Hat BL-Rolle
  is_abteilungsleiter?: boolean;  // Schnellzugriff: Hat AL-Rolle
}
