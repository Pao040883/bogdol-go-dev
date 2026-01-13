/**
 * Department & Organizational Structure Interfaces
 */

export interface Department {
  id: number;
  company?: number | null;
  company_name?: string;
  parent?: number | null;
  parent_name?: string;
  name: string;
  short_name?: string;
  description?: string;
  org_type?: string;
  hierarchy_level: number;
  is_staff_department: boolean;  // Stabsstelle
  search_keywords?: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentRole {
  id: number;
  name: string;
  short_name?: string;
  description?: string;
  org_type?: string;
  hierarchy_level: number;
  responsibilities?: string;
  permissions?: string[];
  is_management: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentMember {
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
  is_staff_position: boolean;  // Stabsstellen-Position
  display_order: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: number;
  department: number;
  department_name?: string;
  name: string;
  description?: string;
  lead?: number | null;
  lead_name?: string;
  members?: number[];
  member_count?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: number;
  name: string;
  short_name?: string;
  description?: string;
  address?: string;
  contact_info?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
