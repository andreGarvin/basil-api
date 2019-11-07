import { Document, Schema, model } from "mongoose";

import * as uuid from "uuid/v4";

// config
import { HOST } from "../../config";

// types
import { UserAccount } from "../authentication/types";

export interface UserModel extends UserAccount, Document {
  id: string;
}

// This modal invites collection
const userSchema = new Schema({
  // the user id
  id: {
    default: () => {
      // generating a user id
      return uuid(HOST, uuid.URL)
        .split("-")
        .join("");
    },
    type: String
  },

  // the user's hashed password
  hash: {
    default: "",
    type: String
  },

  // this user jwt token for authenticating with the service
  token: {
    required: true,
    type: String
  },

  // this is the user's email
  email: {
    required: true,
    type: String
  },

  // weather or not the user create their account under google
  is_google_account: {
    default: false,
    type: Boolean
  },

  gender: {
    default: "other",
    required: true,
    type: String
  },

  date_of_birth: {
    required: true,
    type: Date
  },

  // the user's avatar name
  username: {
    required: true,
    type: String
  },

  // the user's display name
  display_name: {
    type: String,
    default: ""
  },

  // if the user is a admin of the platform
  is_admin: {
    default: false,
    type: Boolean
  },

  // weather or not the user's email has been verified
  verified: {
    default: false,
    type: Boolean
  },

  // weather or not the user's account has been deactivated
  deactivated: {
    default: false,
    type: Boolean
  },

  // a time stamp the last time the user logged into their account
  last_login_at: {
    default: "",
    type: String
  },

  // a url of the user's profile photo
  photo_url: {
    default: "",
    type: String
  },

  // the user's bio description of their profile
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
