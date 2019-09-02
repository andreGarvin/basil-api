import { Document, Schema, model } from "mongoose";

import * as uuid from "uuid/v4";

// types
import { Workspace } from "./types";

export interface WorkspaceModel extends Workspace, Document {
  id: string;
}

const workspaceSchema = new Schema({
  // unique generated id for the workspace
  id: {
    default: () =>
      uuid(process.env.HOST, uuid.URL)
        .split("-")
        .join(""),
    required: true,
    type: String
  },

  // a time stamp of when the workspace was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  /* this field is for differentiating classes owned by the same user,
    the most common use case if a professor teaching different sections */
  section: {
    type: String
  },

  // if the workspace has been archived
  archived: {
    default: false,
    type: Boolean
  },

  // the name of the workspace
  name: {
    requied: true,
    type: String
  },

  // the user who created the workspace
  creator: {
    required: true,
    type: String
  },

  // the type of workspace
  type: {
    default: "class",
    required: true,
    type: String
  },

  // the workspace bio description
  description: String,

  // This is a relational field for the school id in the p_registry collection
  school_id: {
    required: true,
    type: String
  },

  scope: {
    /* This field is to limit the visibillity of the different types of workspaces
      in the workspace collection. For example, classes or clubs can be public
      all users under the school but other users from other schools. The
      scope of the workspace controls its public view.
  
        scopes:
          * private: The workspace (aka class/club) is not public. Only admins of the workspace
            can send a invite to users or new memebers to join the workspace. Other user's in the
            school can not send a request to join the worksapce and can not publicly search for
            the workspace
  
          * public: This workspace (aka class/club) is visible to all user's that are under the
            same school the workspace was created under, however not other schools. Any user
            can send a request to join the workspace and even know of its existence through
            sreaching for workspaces in school
  
          * global: This allows a workspace (aka class/club) is be publicly available to all schools
            on the platform. Any user on the platform can send a request to join the workspace and
            admins' of the workspace can send a invite to any user on the platform to join the
            workspace
    */
    default: "private",
    required: true,
    type: String
  }
});

export default model<WorkspaceModel>("workspaces", workspaceSchema);
