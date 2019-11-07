import { Document, Schema, model } from "mongoose";

// types
import { GoogleAccessTokens } from "./index";

export interface GoogleAccessTokensModel extends GoogleAccessTokens, Document {
  id: string;
}

// This modal invites collection
const userSchema = new Schema({
  // the user id
  email: {
    required: true,
    type: String
  },

  // the user's acces token from google
  access_token: {
    required: true,
    type: String
  },

  // the id token
  id_token: {
    required: true,
    type: String
  },

  // the user's refresh token to get a new access token
  refresh_token: {
    required: true,
    type: String
  },

  // When the user access token expires
  expires_at: {
    required: true,
    type: Date
  }
});

export default model<GoogleAccessTokensModel>(
  "google_access_tokens",
  userSchema
);
