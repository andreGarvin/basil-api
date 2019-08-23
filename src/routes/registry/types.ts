export interface RegistratedSchool {
  id: string;
  name: string;
  type?: string;
  domain?: string;
  created_at: string;
  license_key: string;
  deactivated: boolean;
}

export interface RegisteredSchoolInfo {
  id: string;
  name: string;
  domain?: string;
}
