export interface WorkspaceMemberRequest {
  user_id: string;
  sent_at: string;
  workspace_id: string;
}

export interface SavedWorkspaceMemberRequest {
  name: string;
  type: string;
  section: string;
  sent_at: string;
  workspace_id: string;
}

export interface WorkspaceMemberRequestInfo {
  name: string;
  user_id: string;
  sent_at: string;
  photo_url: string;
}
