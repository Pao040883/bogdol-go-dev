// Erweiterte Typen für das optimierte Absence System

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  // Organigramm-Felder
  company?: string;
  department?: string;
  job_title?: string;
  division?: string;
  phone_number?: string;
  mobil_number?: string;
  supervisor?: number;
  // Urlaubsfelder
  vacation_entitlement?: number;
  carryover_vacation?: number;
  vacation_year?: number;
  remaining_vacation_days?: number;
  used_vacation_days?: number;
}

export interface AbsenceType {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  requires_approval: boolean;
  requires_certificate: boolean;
  advance_notice_days: number;
  max_consecutive_days?: number;
  is_active: boolean;
  icon?: string;
  color: string;
  deduct_from_vacation?: boolean;
}

export interface AbsenceComment {
  id: number;
  absence: number;
  author: User;
  author_name: string;
  comment_type: 'user_comment' | 'supervisor_feedback' | 'hr_note' | 'revision_request' | 'approval_note' | 'rejection_note';
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface AbsenceConflict {
  id: number;
  conflict_type: 'team_overlap' | 'representative_conflict' | 'department_shortage' | 'critical_period';
  conflicting_absence?: Absence;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  resolution_comment?: string;
  created_at: string;
  resolved_at?: string;
}

export interface Absence {
  id?: number;
  user: User;
  user_data?: User; // Verschachtelte User-Daten vom Backend
  absence_type: AbsenceType;
  absence_type_data?: AbsenceType; // Verschachtelte AbsenceType-Daten vom Backend
  absence_type_id?: number;
  start_date: string;
  end_date: string;
  manual_duration_days?: number; // Manuell eingegebene Arbeitstage
  reason?: string;
  
  // Status und Workflow
  status: 'pending' | 'approved' | 'rejected' | 'hr_processed' | 'cancelled' | 'revision_requested';
  status_display?: string;
  
  // Revision/Bearbeitung
  is_revision?: boolean;
  revision_of?: number;
  revision_reason?: string;
  
  // Genehmigung
  approved_by?: User;
  approved_by_data?: User; // Verschachtelte Daten vom Backend
  approved_at?: string;
  approval_comment?: string;
  
  // Ablehnung
  rejected_by?: User;
  rejected_by_data?: User; // Verschachtelte Daten vom Backend
  rejected_at?: string;
  rejection_reason?: string;
  
  // Vertretung
  representative?: User;
  representative_data?: User; // Verschachtelte Daten vom Backend
  representative_id?: number;
  representative_confirmed: boolean;
  representative_confirmed_at?: string;
  
  // HR Integration
  hr_notified: boolean;
  hr_notified_at?: string;
  hr_comment?: string;
  hr_processed?: boolean;
  hr_processed_by?: User;
  hr_processed_by_data?: User; // Verschachtelte Daten vom Backend
  hr_processed_at?: string;
  
  // Chat Integration
  conversation?: number; // FK zu ChatConversation
  change_history?: Array<{
    timestamp: string;
    user: string;
    user_id: number;
    changes: { [field: string]: { old: string; new: string } };
    reason?: string;
    previous_status?: string;
  }>;
  
  // Dateien
  certificate?: string;
  additional_documents?: string;
  
  // Konflikte und Kommentare
  conflicts?: AbsenceConflict[];
  comments?: AbsenceComment[];
  
  // Berechnete Felder
  duration_days: number;
  workday_duration?: number;
  is_pending: boolean;
  is_approved: boolean;
  is_rejected: boolean;
  
  // Zeitstempel
  created_at: string;
  updated_at: string;
  
  // Legacy für Rückwärtskompatibilität
  approved?: boolean;
}

export interface AbsenceCreateRequest {
  absence_type_id: number;
  start_date: string;
  end_date: string;
  manual_duration_days?: number; // Manuelle Angabe der Arbeitstage
  reason?: string;
  representative_id?: number;
  certificate?: File;
  additional_documents?: File;
}

export interface AbsenceApprovalRequest {
  action: 'approve' | 'reject';
  comment?: string;
  reason?: string;
}

export interface AbsenceFilters {
  status?: string[];
  absence_type?: number[];
  user?: number[];
  start_date?: string;
  end_date?: string;
  has_conflicts?: boolean;
  search?: string;
}

export interface VacationSummary {
  vacation_entitlement: number;
  carryover_vacation: number;
  vacation_year: number;
  used_vacation_days: number;
  remaining_vacation_days: number;
  total_entitlement: number;
}

export interface CommentRequest {
  content: string;
  comment_type?: string;
  is_internal?: boolean;
}

export interface RevisionRequest {
  start_date: string;
  end_date: string;
  reason?: string;
  revision_reason: string;
  absence_type_id: number;
  representative_id?: number;
}
