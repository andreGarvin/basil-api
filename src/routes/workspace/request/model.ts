import { Document, Schema, model, set } from "mongoose";

// types
import { WorkspaceMemberRequest } from "./types";

export interface WorkspaceMemberRequestModel
  extends WorkspaceMemberRequest,
    Document {
  id: string;
}

const workspaceMemberRequestsSchema = new Schema({
  // a time stamp of when the request sent/created
  sent_at: {
    default: () => new Date().toISOString(),
    required: true,
    type: Date
  },

  // the id of the user who sent the request
  user_id: {
    required: true,
    type: String
  },

  // the id of the workspace the user is requesting to join
  workspace_id: {
    required: true,
    type: String
  }
});

// this creates a index on the documents
set("useCreateIndex", true);

workspaceMemberRequestsSchema.index(
  { user_id: 1, workspace_id: 1 },
  { unique: true }
);

export default model<WorkspaceMemberRequestModel>(
  "workspace_member_requests",
  workspaceMemberRequestsSchema
);
