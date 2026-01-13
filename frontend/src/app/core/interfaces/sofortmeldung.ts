// sofortmeldung.model.ts
export interface Sofortmeldung {
  id?: number;
  companyNumber: string;
  insurance_number?: string;
  first_name: string;
  last_name: string;
  citizenship?: number;
  group: number;
  start_date: string;
  birth_land?: string;
  birth_gender?: 'M' | 'W' | 'D' | 'X';
  birth_name?: string;
  birth_date?: string;
  birth_place?: string;
  country_code?: string;
  city_name?: string;
  zip_code?: string;
  street_name?: string;
  createdAt?: string;
  createdBy?: string;
  status: boolean;
  tan?: string;
  url?: string;
}
