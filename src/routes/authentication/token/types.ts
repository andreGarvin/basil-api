export interface DecodedToken {
  email: string;
  is_admin: boolean;
  expires_at: string;
}

export interface TokenAuthenticationResponse {
  email: string;
  user_id: string;
  is_admin: boolean;
  should_refresh_token: boolean;
}
