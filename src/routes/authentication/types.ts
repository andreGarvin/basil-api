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
}

export interface AccountCredentials {
  role: string;
  token: string;
  user_id: string;
  school_id: string;
}

export interface NewUserInfo {
  role: string;
  email: string;
  password: string;
  last_name: string;
  first_name: string;
  school_name: string;
}
