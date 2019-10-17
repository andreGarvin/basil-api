import { Document, Schema, model } from "mongoose";

// types
import { DirectMessageMember } from "../types";

export interface DirectMessageMemberModel
  extends DirectMessageMember,
    Document {
  id: string;
}

const directMessageMemberSchema = new Schema({
  // the user id of the workspace member
  user_id: {
    required: true,
    type: String
  },

  // id of the workspace the group is under
  workspace_id: {
    required: true,
    type: String
  },

  // the id of the direct message
  direct_message_id: {
    required: true,
    type: String
  },

  // the id of the last message that the user has seen
  last_read_message_id: {
    default: "",
    type: String
  }
});

export default model<DirectMessageMemberModel>(
  "direct_message_members",
  directMessageMemberSchema
);
