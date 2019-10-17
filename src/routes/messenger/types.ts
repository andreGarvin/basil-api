interface Chat {
  id: string;
  archived: boolean;
  created_at: string;
  workspace_id: string;
}

export interface DirectMessage extends Chat {
  is_direct_message?: boolean;
}

export interface Group extends Chat {
  name: string;
  creator: string;
  is_private: boolean;
  is_channel: boolean;
  description: string;
}

export interface Meta {
  is_admin: boolean;
  is_creator: boolean;
}

export interface GroupSearchResult extends Chat {
  meta: Meta;
  name: string;
  is_private: boolean;
  is_channel: boolean;
  description: string;
}

export interface AggregatedGroupInfo extends Group {
  meta: Meta;
}

export interface AggregatedDirectMessageInfo extends DirectMessage {
  member: {
    name: string;
    email: string;
    status: string;
    photo_url: string;
    is_active: boolean;
    is_workspace_admin: boolean;
  };
}

// export interface AggregatedChat {
//   id: string;
//   name?: string;
//   creator?: string;
//   archived: boolean;
//   created_at: string;
//   is_channel: boolean;
//   is_private?: boolean;
//   description?: string;
//   workspace_id: string;
//   is_direct_message: boolean;
//   meta: {
//     is_member: boolean;
//     last_read_since: string;
//   };
// }
