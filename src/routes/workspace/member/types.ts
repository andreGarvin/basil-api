export interface WorkspaceMember {
  status: string;
  user_id: string;
  removed: boolean;
  joined_at: string;
  is_admin: boolean;
  is_active: boolean;
  workspace_id: string;
  last_active_at: string;
}

export interface WorkspaceMemberInfo extends WorkspaceMember {
  is_creator: boolean;
}

export interface NewMember {
  email: string;
  admin: boolean;
}

export interface AddedMemberBulkResponse {
  email: string;
  added?: boolean;
  is_admin: boolean;
  invited?: boolean;
  error_code?: string;
}

export interface bulkMemberPreflightCheck extends AddedMemberBulkResponse {
  user_id?: string;
  unremove?: boolean;
}

export interface WorkspaceMemberAggregation {
  name: string;
  email: string;
  status: string;
  user_id: string;
  removed: boolean;
  joined_at: string;
  is_admin: boolean;
  photo_url: string;
  is_active: boolean;
  last_active_at: string;
}

export interface PendingWorkspaceMembers {
  email: string;
  is_admin: string;
}
