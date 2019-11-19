import { Document, Schema, model } from "mongoose";

// types
import { BlockedUser } from "../types";

export interface BlockedUserModel extends BlockedUser, Document {
  user_id: string;
}

// This modal blocked_users collection schema
const blockedUserSchema = new Schema({
  // the id of the user
  user_id: {
    required: true,
    type: String
  },

  // the id of the account that was blocked
  blocked_user_id: {
    required: true,
    type: String
  },

  // a time stamp when the user blocked the other account
  blocked_since: {
    default: () => new Date().toISOString(),
    type: Date
  }
});

blockedUserSchema.index({ user_id: 1, blocked_user_id: 1 }, { unique: true });

export default model<BlockedUserModel>("blocked_users", blockedUserSchema);
