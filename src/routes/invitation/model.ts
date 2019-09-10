import { Document, Schema, set, model } from "mongoose";

import * as uuid from "uuid/v4";

// types
import { Invitation } from "./types";

export interface InvitationModel extends Invitation, Document {
  id: string;
}

// This modal invites collection
const invitationSchema = new Schema({
  // the invitation id
  id: {
    default: () =>
      uuid(process.env.HOST, uuid.URL)
        .split("-")
        .join(""),
    required: true,
    type: String
  },

  // the email of the user who is sending the invite
  from: {
    required: true,
    type: String
  },

  // The person the invite is being sent to
  email: {
    required: true,
    type: String
  },

  // this is a identifier for which school the invitation belongs to
  school_id: {
    required: true,
    type: String
  },

  // time stamp of when the invite was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  /* time stamp of when the invite is to expire, this is handled
    by mongodb index. when if the time reached the document will
    be deleted */
  expires_at: {
    type: Date,
    index: true,
    required: true
  },

  /* This is field show weather the user or the service sent a user student,
    profressor, or admin invite to join */
  type: {
    required: true,
    type: String
  },

  // time stamp of when the invite was update
  last_updated_at: {
    default: null,
    type: Date
  }
});

// this creates a index on the documents
set("useCreateIndex", true);

// This creates a index on the field 'expires_at' and deletes the doucment after zero seconds
invitationSchema.index({ expires_at: 1 }, { exipresAfterSeconds: 0 });

invitationSchema.index({ email: 1, school_id: 1 }, { unique: true });

export default model<InvitationModel>("invitations", invitationSchema);
