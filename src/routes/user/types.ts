export interface UserProfile {
  id: string;
  username: string;
  photo_url: string;
  created_at: string;
  description?: string;
  display_name: string;
}

export interface UpdateUserInfo {
  gender?: string;
  username?: string;
  description?: string;
  display_name?: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  photo_url: string;
  display_name: string;
  is_following_user: boolean;
}

export interface AggregatedProfileInfo extends UserProfile {
  // post_count: number;
  // followed_by: string[];
  follower_count: number;
  following_count: number;
  meta: {
    blocked_user: boolean;
    is_following_user: boolean;
    // is_subscribed_to_mobile_push: boolean;
  };
}

export interface BlockedUser {
  user_id: string;
  blocked_since: string;
  blocked_user_id: string;
}

export interface BlockedUserAggregation {
  id: string;
  username: string;
  photo_url: string;
}

export interface Follower {
  user_id: string;
  followed_since: string;
  following_user_id: string;
}
