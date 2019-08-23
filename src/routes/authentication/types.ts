export interface UserAccount {
  id: string;
  hash: string;
  role: string;
  token: string;
  email: string;
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

export interface newUserInfo {
  role: string;
  email: string;
  password: string;
  last_name: string;
  school_id: string;
  first_name: string;
}
