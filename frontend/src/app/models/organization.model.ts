/**
 * Organizational Structure Models
 * Fachbereiche, Zuordnungen, Vertretungen
 */

export enum ProficiencyLevel {
  BASIC = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
  EXPERT = 4
}

export interface Specialty {
  id: number;
  department: number;
  department_name?: string;
  parent?: number | null;
  parent_name?: string;
  name: string;
  code: string;
  description?: string;
  full_path?: string;
  search_keywords?: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MemberSpecialty {
  id: number;
  member: number;
  specialty: number;
  specialty_data?: Specialty;
  member_data?: {
    id: number;
    user_id: number;
    user_name: string;
    department_id: number;
    department_name: string;
    position_title?: string;
  };
  user_id?: number;
  user_name?: string;
  proficiency_level: ProficiencyLevel;
  is_primary: boolean;
  notes?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentMemberDetail {
  id: number;
  user: number;
  user_data?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  department: number;
  department_name?: string;
  role: number;
  role_name?: string;
  reports_to?: number | null;
  reports_to_name?: string;
  position_title?: string;
  is_primary: boolean;
  is_staff_position: boolean;
  display_order: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  
  // Specialty-Related
  specialties?: Specialty[];
  specialty_assignments?: MemberSpecialty[];
  specialty_ids?: number[];
  
  created_at?: string;
  updated_at?: string;
}

export interface WorkorderAssignment {
  id: number;
  submitter: number;
  submitter_name?: string;
  processor: number;
  processor_name?: string;
  specialty: number;
  specialty_data?: Specialty;
  is_auto_assigned: boolean;
  notes?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SubstituteAssignment {
  id: number;
  original_user: number;
  original_user_name?: string;
  substitute_user: number;
  substitute_user_name?: string;
  absence?: number | null;
  absence_data?: {
    id: number;
    start_date: string;
    end_date: string;
    type: string;
    status: string;
  };
  specialties: number[];
  specialties_data?: Specialty[];
  specialty_ids?: number[];
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionCheckRequest {
  action: 'full_access' | 'has_specialty' | 'my_specialties' | 'active_substitutions' |
          'can_process_workorder' | 'can_view_workorder' | 'can_reassign_workorder' |
          'can_approve_absence' | 'can_view_absence';
  specialty_code?: string;
  department?: number;
  active_only?: boolean;
  date?: string;
  workorder_id?: number;
  absence_id?: number;
}

export interface PermissionCheckResponse {
  has_access?: boolean;
  has_specialty?: boolean;
  can_process?: boolean;
  can_view?: boolean;
  can_reassign?: boolean;
  can_approve?: boolean;
  specialties?: Array<{
    id: number;
    code: string;
    name: string;
    department: string;
  }>;
  substitutions?: Array<{
    id: number;
    original_user: string;
    substitute_user: string;
    specialties: string[];
    absence_start: string | null;
    absence_end: string | null;
  }>;
}

export interface MyAssignmentsResponse {
  as_submitter: WorkorderAssignment[];
  as_processor: WorkorderAssignment[];
}

export interface MySubstitutionsResponse {
  i_substitute: SubstituteAssignment[];
  substituted_by: SubstituteAssignment[];
}

export interface AutoAssignRequest {
  submitter_id: number;
  specialty_code: string;
}

export interface AutoAssignResponse {
  created: boolean;
  assignment: WorkorderAssignment;
}
