export interface DecodedToken {
  user_id: string;
  school_id: string;
}

export interface TokenAuthenticationResponse {
  token?: string;
  user_id: string;
  school_id: string;
}

export interface RefreshedToken {
  user_id: string;
  school_id: string;
  refreshed_token: string;
}
