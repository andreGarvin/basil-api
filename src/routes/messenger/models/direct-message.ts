import * as uuid from "uuid/v4";

import { Document, Schema, model } from "mongoose";

// types
import { DirectMessage } from "../types";

export interface DirectMessageModel extends DirectMessage, Document {
  id: string;
}

const directMessageSchema = new Schema({
  // id of the direct message
  id: {
    // generating random id string
    default: () => uuid(process.env.HOST, uuid.URL),
    required: true,
    type: String
  },

  // weather or not the direct message has been archived
  archived: {
    default: false,
    type: Boolean
  },

  // the id of the workspace the direct message is under
  workspace_id: {
    default: false,
    required: true,
    type: String
  },

  // a time stamp to when the direct message was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  /* the member of the direct message, this to make easier
  colleration for dircet messages in workspaces */
  members: [
    {
      required: true,
      type: String
    }
  ]
});

export default model<DirectMessageModel>(
  "direct_messages",
  directMessageSchema
);
