import { Document, Schema, model, set } from "mongoose";

// types
import { WorkspaceMember } from "./types";

export interface WorkspaceMemberModel extends WorkspaceMember, Document {
  id: string;
}

// the workspace members collections
const workspaceMemberSchema = new Schema({
  // a time stamp of when the user was active in the workspace
  last_active_at: {
    default: null,
    type: Date
  },

  // the id of the workspace converstaion (aka direct message, channel, group) the user was when active in the workspace
  // last_chat_id: String,

  // this is a feature that allows user to set indication to ther user of their avaiblity in the workspace
  // valid statuses: ['AWAY', 'BUSY', 'AVAILABLE', 'VACATION']
  status: {
    default: "",
    type: String
  },

  // determing the permissons a person has in the workspace
  is_admin: {
    default: false,
    type: Boolean
  },

  // the user's id. this have a relational refernce to getting a user data
  user_id: {
    required: true,
    type: String
  },

  // A indicator if the user is active in the workspace or 'online'
  is_active: {
    default: false,
    type: Boolean
  },

  // the id of th workspace
  workspace_id: {
    required: true,
    type: String
  },

  // a boolean value of wheather the user was removed from the workspace
  removed: {
    default: false,
    type: Boolean
  },

  // a time stamp of when the user was add the workspace
  joined_at: {
    default: () => new Date().toISOString(),
    type: Date
  }
});

// this creates a index on the documents
set("useCreateIndex", true);

workspaceMemberSchema.index({ user_id: 1, workspace_id: 1 }, { unique: true });

export default model<WorkspaceMemberModel>(
  "workspace_members",
  workspaceMemberSchema
);
