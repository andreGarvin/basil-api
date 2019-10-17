import { Document, Schema, model } from "mongoose";

// types
import { GroupMember } from "../types";

export interface GroupMemberModel extends GroupMember, Document {
  id: string;
}

const GroupSchema = new Schema({
  // user id of the workspace member
  user_id: {
    required: true,
    type: String
  },

  // weather or not the user is a admin of the group
  is_admin: {
    default: false,
    type: Boolean
  },

  // weather or not the user was "removed" from the group
  removed: {
    default: false,
    type: Boolean
  },

  // id of the workspace the group is under
  workspace_id: {
    required: true,
    type: String
  },

  // the id of the group
  group_id: {
    default: false,
    required: true,
    type: String
  },

  // a time stamp to when the member joined the group
  joined_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  // the id of the last message that the user has seen
  last_read_message_id: {
    type: String,
    default: ""
  }
});

export default model<GroupMemberModel>("group_members", GroupSchema);
