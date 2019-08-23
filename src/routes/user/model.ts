import { Document, Schema, model } from "mongoose";

// types
import { UserAccount } from "../authentication/types";

export interface UserModel extends UserAccount, Document {
  id: string;
}

// This modal invites collection
const userSchema = new Schema({
  // the user id
  id: {
    required: true,
    type: String
  },

  // the user's hash
  hash: {
    required: true,
    type: String
  },

  // this is the user's personal jwt token
  token: {
    required: true,
    type: String
  },

  // this is the user's email
  email: {
    required: true,
    type: String
  },

  // the user of the user
  role: {
    default: "student",
    required: true,
    type: String
  },

  // fi the user has verified there account
  verified: {
    default: false,
    type: Boolean
  },

  // a time stamp of when the user last logged into their account
  last_login_at: Date,

  // The users porfile photo url
  photo_url: String,

  // the user's bio description
  description: String,

  // field to hold temporary reset password token
  temporary_reset_password_token: String,

  // a time stamp of when the account was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  // the id of the school the user accoutn is under
  school_id: {
    required: true,
    type: String
  },

  // The user first name
  first_name: {
    required: true,
    type: String
  },

  // the user's clast name
  last_name: {
    required: true,
    type: String
  },

  // if the user's account has been deactivated
  deactivated: {
    default: false,
    type: Boolean
  }
});

export default model<UserModel>("users", userSchema);
