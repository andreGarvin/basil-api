export interface UserAccount {
  id: string;
  hash?: string;
  token: string;
  email: string;
  gender: string;
  username: string;
  is_admin: boolean;
  verified: boolean;
  photo_url: string;
  created_at: string;
  suspended: boolean;
  deactivated: boolean;
  display_name: string;
  description?: string;
  date_of_birth: string;
  last_login_at?: string;
  is_google_account: boolean;
}

export interface AccountCredentials {
  email: string;
  token: string;
  user_id: string;
  is_admin: boolean;
}

export interface NewUserInfo {
  email: string;
  gender: string;
  username: string;
  password: string;
  display_name: string;
  date_of_birth: string;
}
