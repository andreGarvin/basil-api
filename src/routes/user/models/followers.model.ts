import { Document, Schema, model } from "mongoose";

// types
import { Follower } from "../types";

export interface FollowerModel extends Follower, Document {
  user_id: string;
}

// This modal follower collection schema
const followerSchema = new Schema({
  // the user id of the follower
  user_id: {
    required: true,
    type: String
  },

  // the id of the account the user is following
  following_user_id: {
    required: true,
    type: String
  },

  // a time stamp when the user started following the account
  followed_since: {
    default: () => new Date().toISOString(),
    type: Date
  }
});

followerSchema.index({ user_id: 1, following_user_id: 1 }, { unique: true });

export default model<FollowerModel>("followers", followerSchema);
