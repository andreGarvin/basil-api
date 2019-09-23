interface Chat {
  id: string;
  archived: boolean;
  created_at: string;
  workspace_id: string;
}

export interface DirectMessage extends Chat {
  members: string[];
  is_direct_message?: boolean;
}

export interface Group extends Chat {
  name: string;
  creator: string;
  is_private: boolean;
  is_channel: boolean;
  description: string;
}

export interface GroupSearchResult extends Chat {
  name: string;
  is_private: boolean;
  is_channel: boolean;
  description: string;
  meta: {
    is_creator: boolean;
  };
}

// interface AggregatedChat {
//   id: string;
//   name?: string;
//   creator?: string;
//   archived: boolean;
//   created_at: string;
//   is_private?: boolean;
//   is_channel: boolean;
//   description?: string;
//   workspace_id: string;
//   is_direct_message: boolean;
//   mea: {
//     is_member: boolean;
//     last_read_since: string;
//   };
// }
