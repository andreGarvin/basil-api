export type UserRole = "student" | "professor" | "admin";

export interface UserAccount {
  id: string;
  hash: string;
  token: string;
  email: string;
  role: UserRole;
  verified: boolean;
  last_name: string;
  photo_url: string;
  school_id: string;
  created_at: string;
  first_name: string;
  deactivated: boolean;
  description?: string;
  last_login_at?: string;
  temporary_reset_password_token?: string;
}
