import * as uuid from "uuid/v4";

import { Document, Schema, model } from "mongoose";

// types
import { Group } from "../types";

export interface GroupModel extends Group, Document {
  id: string;
}

const GroupSchema = new Schema({
  // id of the group
  id: {
    // generating random id string
    default: () => uuid(process.env.HOST, uuid.URL),
    required: true,
    type: String
  },

  // the name of the group
  name: {
    required: true,
    default: false,
    type: String
  },

  // the user id of the workspace member who created the group
  creator: {
    required: true,
    type: String
  },

  // weather or not the group is a channel
  is_channel: {
    default: false,
    type: Boolean
  },

  // weather or not the group is private or not, for channels its false
  is_private: {
    default: false,
    type: Boolean
  },

  // the the bio description of the group
  description: {
    type: String,
    default: ""
  },

  // weather or not the group has been archived
  archived: {
    default: false,
    type: Boolean
  },

  // the id of the workspace the group is under
  workspace_id: {
    default: false,
    required: true,
    type: String
  },

  // a time stamp to when the group was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  }
});

export default model<GroupModel>("groups", GroupSchema);
