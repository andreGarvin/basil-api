import { Document, Schema, model } from "mongoose";

// module
import { InvitationRoles } from "../invitation";

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

  // this is the user jwt token
  token: {
    required: true,
    type: String
  },

  // this is the user's email
  email: {
    required: true,
    type: String
  },

  // the id of the school the user account is under
  school_id: {
    required: true,
    type: String
  },

  // the role of the user in the school
  role: {
    default: "student",
    required: true,
    type: String
  },

  // the user account being verified
  verified: {
    default: false,
    type: Boolean
  },

  // if the user's account has been deactivated
  deactivated: {
    default: false,
    type: Boolean
  },

  // a time stamp of when the user last logged into their account
  last_login_at: {
    default: null,
    type: Date
  },

  // The users profile photo url
  photo_url: String,

  // user first name
  first_name: {
    required: true,
    type: String
  },

  // user clast name
  last_name: {
    required: true,
    type: String
  },

  // the user's bio description of the user
  description: {
    default: "",
    type: String
  },

  // a time stamp when the account was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  }
});

export default model<UserModel>("users", userSchema);
