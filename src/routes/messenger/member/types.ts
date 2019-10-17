export interface GroupMember {
  user_id: string;
  group_id: string;
  removed: boolean;
  is_admin: boolean;
  joined_at: string;
  workspace_id: string;
  last_read_message_id?: string;
}

export interface DirectMessageMember {
  user_id: string;
  workspace_id: string;
  direct_message_id: string;
  last_read_message_id?: string;
}
