export interface Invitation {
  id: string;
  from: string;
  type: string;
  email: string;
  expires_at: string;
  created_at: string;
  school_id: string;
  last_updated_at?: string;
}

export interface InvitationInfo {
  id: string;
  type: string;
  email: string;
  school_id: string;
  expires_at: string;
  created_at: string;
}

export interface SentInvitationResponse {
  id: string;
  type: string;
  email: string;
}

export interface bulkInvitationInsertResponse {
  id?: string;
  email: string;
  inserted: boolean;
  error_code?: string;
}
