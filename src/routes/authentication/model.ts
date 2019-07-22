import { Schema, Model, model, Document } from "mongoose";

import { UserAccount } from "./types";

interface UserModel extends UserAccount, Document {
  id: string;
}

const userSchema = new Schema({
  // The user id
  id: {
    required: true,
    type: String
  },

  // a time stamp of when the user last logged into their account
  last_login_at: Date,

  // The users porfile photo url that can be changed to another JPEG, PNG, or GIF
  photo_url: String,

  // the use bio description
  description: String,

  // field to hold temporary tokens a user may have
  temporary_reset_password_token: String,

  // a time stamp of when the account was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  // the school the user has created their account under
  school_id: {
    required: true,
    type: String
  },

  token: {
    required: true,
    type: String
  },

  // The hash of the user password
  hash: {
    required: true,
    type: String
  },

  // The role the student is in the school on the service
  role: {
    required: true,
    type: String
  },

  // The user university email
  email: {
    required: true,
    type: String
  },

  // The user fiest and last name
  first_name: {
    required: true,
    type: String
  },

  last_name: {
    required: true,
    type: String
  },

  // If the users account has been deactivated due to password reset
  deactivated: {
    default: false,
    type: Boolean
  },

  // if the email the account has been verified
  verified: {
    default: false,
    type: Boolean
  }
});

export default model<UserModel>("users", userSchema);
