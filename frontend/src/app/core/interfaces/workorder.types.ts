/**
 * Arbeitsschein / Work Order Interfaces
 */

export interface WorkOrderClient {
  id: number;
  name: string;
  street?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkObject {
  id: number;
  client: number;
  client_name?: string;
  name: string;
  street?: string;
  postal_code?: string;
  city?: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderTemplate {
  id?: number;
  name: string;
  description?: string;
  
  // Client & Object
  client: number;
  client_name?: string;
  work_object?: number | null;
  work_object_name?: string;
  
  // Work Details
  work_type: string;
  work_description?: string;
  work_days: number;
  work_schedule?: string;
  
  // Notes
  customer_notes?: string;
  internal_notes?: string;
  
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFromTemplateRequest {
  template_id: number;
  start_date: string;
  end_date: string;
  project_number?: string;
}

export interface WorkOrder {
  id?: number;
  order_number?: string;
  object_number?: string;
  project_number?: string;
  template?: number | null;
  
  // Client & Object
  client: number;
  client_name?: string;
  client_details?: WorkOrderClient;
  work_object?: number | null;
  work_object_name?: string;
  work_object_details?: WorkObject;
  
  // Work Details
  work_type: string;
  work_description?: string;
  start_date: string;
  end_date: string;
  month?: string;
  work_days: number;
  work_schedule?: string;
  
  // Leistungsmonat für Abrechnung (OCR-extrahiert)
  leistungsmonat?: string;  // Format: YYYY-MM
  leistungsmonat_ocr_confidence?: number | null;  // 0-100
  
  // Assignment
  assigned_to?: number | null;
  assigned_to_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email?: string;
  };
  created_by?: number | null;
  created_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email?: string;
  };
  
  // Billing Workflow (NEU)
  submitted_at?: string;
  submitted_by?: number | null;
  submitted_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email?: string;
  };
  reviewed_at?: string;
  reviewed_by?: number | null;
  reviewed_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email?: string;
  };
  responsible_billing_user?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email?: string;
  };
  can_mark_billed?: boolean;
  can_cancel?: boolean;
  
  // Duplikat-Erkennung & Download-Tracking (NEU)
  is_duplicate?: boolean;
  duplicate_of?: number | null;
  duplicate_of_details?: {
    id: number;
    order_number: string;
    created_at: string;
    status: string;
  };
  duplicate_checked_at?: string;
  pdf_downloaded?: boolean;
  pdf_downloaded_at?: string;
  pdf_downloaded_by?: number | null;
  pdf_downloaded_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  
  // Haklisten-Abgleich (NEU)
  checklist_match?: {
    id: number;
    object_number: string;
    project_number: string;
    sr_invoice_number?: string;  // Geändert von sr_number
    notes?: string;
    checked_this_month: boolean;
    service_manager?: {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
      full_name: string;
    } | null;
    assigned_billing_user?: {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
      full_name: string;
    } | null;
  };
  optimized_filename?: string;
  
  // Status
  status: 'draft' | 'in_progress' | 'completed' | 'signed' | 'submitted' | 'billed' | 'cancelled';
  status_display?: string;
  
  // Scan/Document
  scanned_document?: string;
  
  // Signatures
  customer_signature?: string;
  customer_signed_at?: string;
  company_signature?: string;
  
  // Notes
  customer_notes?: string;
  internal_notes?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

export interface WorkOrderHistory {
  id: number;
  work_order: number;
  action: 'created' | 'updated' | 'submitted' | 'billed' | 'status_changed' | 'assigned' | 'document_uploaded' | 'cancelled';
  action_display: string;
  performed_by: number | null;
  performed_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  performed_at: string;
  old_status?: string;
  new_status?: string;
  notes?: string;
  metadata?: any;
}

export interface BulkSubmitResponse {
  message: string;
  created_orders: {
    id: number;
    order_number: string;
    filename: string;
    optimized_filename?: string;
    duplicate_info?: {
      is_duplicate: boolean;
      count: number;
      original: string;
    };
    checklist_info?: {
      matched: boolean;
      sr_number?: string;
      notes?: string;
    };
  }[];
  errors: {
    filename: string;
    error: string;
  }[];
}

export interface RecurringWorkOrderChecklist {
  id?: number;
  object_number: string;
  object_description: string;
  project_number: string;
  debitor_number?: string;
  notes?: string;
  sr_invoice_number?: string;  // Geändert von sr_number
  
  client?: number | null;
  client_name?: string;
  work_object?: number | null;
  work_object_name?: string;
  
  // Neue Felder: Zuständigkeiten
  service_manager?: number | null;
  service_manager_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  assigned_billing_user?: number | null;
  assigned_billing_user_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  
  current_month?: string;
  checked_this_month?: boolean;
  last_checked_at?: string;
  last_checked_by?: number | null;
  last_checked_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  
  matching_workorders_count?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
  created_at?: string;
  created_by?: number | null;
  created_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  updated_at?: string;
}

export interface BulkDownloadRequest {
  workorder_ids: number[];
}

export interface MergePdfsRequest {
  workorder_ids: number[];
  sr_number?: string;
}

export interface WorkOrderStatistics {
  total: number;
  draft: number;
  in_progress: number;
  completed: number;
  signed: number;
  invoiced: number;
}

export interface WorkOrderFilters {
  status?: string;
  client?: number;
  work_object?: number;
  assigned_to?: number;
  search?: string;
}
