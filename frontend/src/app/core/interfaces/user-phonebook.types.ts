export interface UserPhonebookEntry {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  department: number | null;  // Department ID
  job_title: string;
  division: string;
  phone_number: string;
  mobile_number: string;
  is_absent: boolean;
  absence_reason: string | null;
  absence_end_date: string | null;
  representative: Representative | null;
}

export interface Representative {
  id: number;
  first_name: string;
  last_name: string;
}
