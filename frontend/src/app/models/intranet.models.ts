/**
 * TypeScript Interfaces für Enterprise Intranet System
 * Profiles, Chat, Presence und Organisation
 */

// ============================================================================
// ORGANIZATION & DEPARTMENT
// ============================================================================

export interface Company {
  id: number;
  name: string;
  code: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  department_count?: number;
  member_count?: number;
}

export interface DepartmentRole {
  id: number;
  name: string;
  code: string;
  hierarchy_level: number;
  org_type: 'administration' | 'operations' | 'both';
  description?: string;
  color: string;
  member_count: number;
  is_active: boolean;
  can_receive_faktura_assignments?: boolean;
}

export interface DepartmentMember {
  id: number;
  user: number;
  user_data: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    avatar?: string | null;
  };
  department: number;
  department_name: string;
  role: number;
  role_data: DepartmentRole;
  position_title?: string;
  reports_to?: number | null;
  reports_to_data?: {
    id: number;
    user_full_name: string;
    role_name: string;
  } | null;
  display_order: number;
  start_date?: string | null;
  end_date?: string | null;
  is_primary: boolean;
  is_active: boolean;
  is_staff_position?: boolean;
  is_company_mismatch?: boolean;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  company?: number | null;
  company_name?: string;
  org_type: 'administration' | 'operations' | 'other';
  org_type_display: string;
  parent?: number | null;
  parent_name?: string;
  member_count: number;
  full_path: string;
  is_active: boolean;
  children?: Department[];  // Für hierarchische Ansicht
}

export interface OrgChartNode {
  id: number;
  name: string;
  code?: string;
  org_type: string;
  org_type_display?: string;
  parent_id?: number | null;
  description?: string;
  member_count?: number;
  members: OrgChartMember[];
  children: OrgChartNode[];
}

export interface OrgChartMember {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  avatar?: string | null;
  role: {
    id: number;
    name: string;
    code: string;
    hierarchy_level: number;
    color: string;
  };
  position_title?: string;
  reports_to_id?: number | null;
  is_primary: boolean;
  is_active: boolean;
  is_staff_position?: boolean;
  is_company_mismatch?: boolean;
}

export interface Team {
  id: number;
  name: string;
  department: number;
  department_name: string;
  lead?: number | null;
  lead_name?: string;
  description?: string;
  member_count: number;
  members: number[];
  members_data: UserBasic[];
  is_active: boolean;
}

// ============================================================================
// USER & PROFILE
// ============================================================================

export interface UserBasic {
  id: number;
  username: string;
  full_name: string;
  avatar?: string | null;
  online_status: 'online' | 'away' | 'busy' | 'offline';
  is_active: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  display_name?: string;
  avatar?: string | null;
  bio?: string;

  // Kontakt
  phone_number?: string;
  mobile_number?: string;
  work_extension?: string;
  email_backup?: string;
  preferred_contact_method?: string;
  full_phone?: string;

  // Organisation
  department?: number | null;
  department_name?: string;
  job_title?: string;
  employee_id?: string;
  direct_supervisor?: number | null;
  supervisor_name?: string;
  functional_supervisors: number[];

  // Skills & Verantwortung
  responsibilities?: string;
  expertise_areas?: string;

  // Standort
  office_location?: string;
  desk_number?: string;
  work_hours?: string;
  timezone?: string;

  // Vertrag
  start_date?: string;
  contract_type?: string;

  // Urlaub
  vacation_entitlement: number;
  carryover_vacation: number;
  vacation_year: number;

  // Notfall
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;

  // Integrationen
  blink_id?: string;
  blink_company?: string;
  teams_id?: string;
  slack_id?: string;

  // E2E Encryption
  public_key?: string;
  public_key_updated_at?: string;

  // Status
  is_searchable: boolean;
  show_phone_in_directory: boolean;
  show_email_in_directory: boolean;
  online_status: 'online' | 'away' | 'busy' | 'offline';
}

export interface UserPresence {
  username: string;
  full_name: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  status_message?: string;
  is_available_for_chat: boolean;
  last_seen: string;  // ISO DateTime
}

// ============================================================================
// CHAT & MESSAGING
// ============================================================================

export interface ChatConversation {
  id: number;
  conversation_type: 'direct' | 'group';
  name?: string;
  description?: string;
  avatar?: string | null;
  participants: number[];
  participants_data: UserBasic[];
  admins?: number[];
  created_by?: number;
  created_by_name?: string;
  messages?: ChatMessage[];
  last_message_at?: string;
  last_message_preview?: {
    sender: string;
    content: string;
    sent_at: string;
  };
  unread_count?: number;
  is_archived: boolean;
}

export interface ChatMessage {
  id: number;
  conversation: number;
  sender: number;
  sender_data: UserBasic;
  message_type: 'text' | 'file' | 'image' | 'system' | 'absence_request' | 'absence_decision';
  content?: string;
  metadata?: { [key: string]: any };  // Für absence_request/absence_decision Daten
  file?: string | null;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  thumbnail?: string | null;
  reply_to?: number | null;
  reply_preview?: {
    id: number;
    sender: string;
    content: string;
  };
  reactions?: { [emoji: string]: string[] };  // emoji -> [usernames]
  read_by: number[];
  read_by_count: number;
  is_edited: boolean;
  is_deleted: boolean;
  is_encrypted?: boolean;
  sent_at: string;  // ISO DateTime
}

export interface ChatTypingIndicator {
  conversation: number;
  user: number;
  started_at: string;  // ISO DateTime
}

// ============================================================================
// WEBSOCKET MESSAGES
// ============================================================================

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Chat WebSocket Messages
export interface ChatMessagePayload extends WebSocketMessage {
  type: 'message' | 'chat_message';  // Backend sendet 'chat_message' für HTTP API
  message_id: number;
  conversation_id?: number;  // Conversation ID (optional für Abwärtskompatibilität)
  sender: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'file' | 'image' | 'system' | 'absence_request' | 'absence_decision';
  metadata?: { [key: string]: any };  // Für Absence-Daten
  timestamp: string;
}

export interface TypingIndicatorPayload extends WebSocketMessage {
  type: 'typing';
  username: string;
  is_typing: boolean;
}

export interface MessageReadPayload extends WebSocketMessage {
  type: 'message_read';
  message_id: number;
  username: string;
}

export interface ReactionPayload extends WebSocketMessage {
  type: 'reaction';
  message_id: number;
  emoji: string;
  username: string;
}

export interface UserJoinedPayload extends WebSocketMessage {
  type: 'user_joined';
  username: string;
  full_name: string;
}

export interface UserLeftPayload extends WebSocketMessage {
  type: 'user_left';
  username: string;
}

export interface ChatErrorPayload extends WebSocketMessage {
  type: 'error';
  message: string;
}

// Presence WebSocket Messages
export interface StatusChangedPayload extends WebSocketMessage {
  type: 'status_changed';
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  status_message?: string;
  full_name: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface ApiError {
  detail: string;
  [key: string]: any;
}

// ============================================================================
// SEARCH & FILTERS
// ============================================================================

export interface ProfileSearchQuery {
  q?: string;           // Freitext-Suche
  department?: number;  // Abteilungs-ID
  job_title?: string;   // Job-Titel
  expertise?: string;   // Expertise-Suche
  location?: string;    // Büro-Standort
  semantic?: boolean;   // Semantische KI-Suche
}

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}
