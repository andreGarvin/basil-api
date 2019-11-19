import { Duplex } from "stream";

// models
import blockUserModel from "./models/block-user.model";
import followerModel from "./models/followers.model";
import userModel from "../authentication/model";

// config
import { HOST, AWS_S3_BUCKET, NO_UPLOAD } from "../../config";

// aws-sdk s3
import S3, { TransformBufferToStream } from "../../common/s3";

// pagination util
import Pagination from "../../common/utils/pagination";
// error response util
import ErrorResponse from "../../common/utils/error";
// logger util
import logger from "../../common/logger";

// types
import {
  UpdateUserInfo,
  UserSearchResult,
  AggregatedProfileInfo,
  BlockedUserAggregation
} from "./types";
import { PaginationResults } from "../../types";
import UserError from "./error-codes";

/**
 * This function takes a multer file object and uploads a buffer of the the new
 * profile photo the user whats to upload and replaces the photo_url file to the
 * new photo url
 *
 * @param userId The id of the user
 * @param photo The multer file object which holds the file information
 */
export const uploadProfilePhoto = async (
  userId: string,
  photo: Express.Multer.File
): Promise<void> => {
  try {
    // this condition control weather or not the file gest uploaded to aws S3
    if (NO_UPLOAD) {
      const params = {
        Key: userId,
        Body: photo.buffer,
        Bucket: AWS_S3_BUCKET
      };

      await S3.putObject(params).promise();
    }

    // updates the 'photo_url' filed to the new url
    const status = await userModel.updateOne(
      {
        id: userId
      },
      {
        $set: {
          /* the ! is used instead of storing a hard code url/route to api route
          to fetch user profile photos. This is so in the future if this routes
          changes we can programatically change the url */
          photo_url: `!${userId}`
        }
      }
    );
    if (status.n === 0) {
      logger.error(
        "Failed to update the user profile photo url in the user collection"
      );

      throw new Error(
        "Failed to update the user profile photo url in the user collection"
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to save/upload a user profile photo");
    }

    throw err;
  }
};

/**
 * This function returns a stream of the user profile photo
 *
 * @param profileUserId The user id of account/profile
 */
export const returnStreamOfUserProfilePhoto = async (
  profileUserId: string
): Promise<Duplex> => {
  try {
    const params = {
      Key: profileUserId,
      Bucket: AWS_S3_BUCKET
    };
    const fileObject = await S3.getObject(params).promise();

    // transforms a buffer of the data coming from S3 to a stream
    return TransformBufferToStream(fileObject.Body);
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to retrieve the stream of the user's profile photo from aws s3"
        );
    }

    throw err;
  }
};

/**
 * This function returns the profile information of a user
 *
 * @param userId The id of the user making the request
 * @param profileUserId The id of the account
 */
export const getUserInfo = async (
  userId: string,
  profileUserId: string
): Promise<AggregatedProfileInfo> => {
  try {
    // checking if the user requesting the information is blocked by the profile
    const blocked = await blockUserModel.findOne({
      user_id: profileUserId,
      blocked_user_id: userId
    });
    if (blocked) {
      throw ErrorResponse(
        UserError.USER_NOT_FOUND_EXCEPTION,
        "this user does not exist",
        {
          http_code: 404
        }
      );
    }

    // fetching the user information from the users collection
    const account = await userModel.findOne(
      {
        verified: true,
        suspended: false,
        id: profileUserId
      },
      {
        id: 1,
        username: 1,
        suspended: 1,
        photo_url: 1,
        created_at: 1,
        description: 1,
        display_name: 1
      }
    );
    if (account === null) {
      throw ErrorResponse(
        UserError.USER_NOT_FOUND_EXCEPTION,
        "this user does not exist",
        {
          http_code: 404
        }
      );
    }

    /* gathering other information about the user follower and following count, but
    filter filtering the users that are suspended, non-verified, and blocked accounts */
    const followingCount = await followerModel.aggregate([
      // all followers.user the matching user id of the profile
      {
        $match: {
          user_id: profileUserId
        }
      },

      // joining users.id on followers.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "following_user_id"
        }
      },

      // making the array field into a object instead
      {
        $unwind: "$users"
      },

      // joining the blocked_users on followers then collection and filtering the join
      {
        $lookup: {
          as: "blocked_users",
          from: "blocked_users",
          let: {
            user_id: userId,
            // the id of the user that is a follower of the profile
            profile_user_id: "$following_user_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    // any doucments that has blocked the user requesting this information
                    { $eq: ["$$profile_user_id", "$user_id"] },
                    { $eq: ["$$user_id", "$blocked_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // filtering the result
      {
        $match: {
          // not including non verified and suspened accounts
          verified: true,
          suspended: false,
          // and removing users that have blocked the user requesting the information
          is_user_blocked: {
            $eq: [{ $size: "$blocked_users" }, 0]
          }
        }
      }
    ]);

    const followerCount = await followerModel.aggregate([
      // all followers that following the profile user id
      {
        $match: {
          following_user_id: profileUserId
        }
      },

      // joining users.id on followers.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "user_id"
        }
      },

      // making the array field into a object instead
      {
        $unwind: "$users"
      },

      // joing blocked_users and followers collection and filtering the result
      {
        $lookup: {
          as: "blocked_users",
          from: "blocked_users",
          let: {
            user_id: userId,
            profile_user_id: "$user_id"
          },
          // filtering the users that have blocked the user the requsting this information
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$profile_user_id", "$user_id"] },
                    { $eq: ["$$user_id", "$blocked_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // filtering the result of any non-verified and suspened accounts, also accounts that have blocked the user
      {
        $match: {
          verified: true,
          suspended: false,
          is_user_blocked: {
            $eq: [{ $size: "$blocked_users" }, 0]
          }
        }
      }
    ]);

    // checking if the user is following the account
    const isFollowingUser = await followerModel.findOne({
      user_id: userId,
      following_user_id: profileUserId
    });

    // checking if the user blocked the account
    const blockedUser = await blockUserModel.findOne({
      user_id: userId,
      blocked_user_id: profileUserId
    });

    let profilePhotoUrl = account.photo_url;
    // if the user file is needs to be resolved
    if (profilePhotoUrl.startsWith("!")) {
      const url = new URL(HOST);
      url.pathname = `/api/user/profile/${profileUserId}/photo`;
      profilePhotoUrl = url.href;
    }

    return {
      id: account.id,
      photo_url: profilePhotoUrl,
      username: account.username,
      created_at: account.created_at,
      description: account.description,
      display_name: account.display_name,
      follower_count: followerCount.length,
      following_count: followingCount.length,
      meta: {
        blocked_user: blockedUser !== null,
        is_following_user: isFollowingUser !== null
      }
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to retrieve user information");
    }

    throw err;
  }
};

/**
 * This function updates public and private information of the user account
 *
 * @param userId The id of the user
 * @param newUserInfo The user new info
 */
export const updateUserInfo = async (
  userId: string,
  newUserInfo: UpdateUserInfo
): Promise<UpdateUserInfo> => {
  try {
    // getting the previously stored user info
    const userInfo = await userModel.findOne(
      {
        id: userId
      },
      {
        gender: 1,
        username: 1,
        description: 1,
        display_name: 1
      }
    );

    // replacing the any missing fields with there previous values or empty value if they are empty
    newUserInfo = {
      description: newUserInfo.description || "",
      display_name: newUserInfo.display_name || "",
      gender: newUserInfo.gender || userInfo.gender || "",
      username: newUserInfo.username || userInfo.username || ""
    };

    // normalizing the information
    newUserInfo.description = newUserInfo.description.trim();
    newUserInfo.display_name = newUserInfo.display_name.trim();
    newUserInfo.username = newUserInfo.username.toLowerCase().trim();

    // update the user profile information
    const status = await userModel.updateOne(
      {
        id: userId
      },
      {
        $set: newUserInfo
      }
    );
    if (status.n === 0) {
      logger.child(status).error("Failed to update user profile information");

      throw new Error("Failed to update user profile information");
    }

    // retrieving the updated user info
    const updateUserInfo = await userModel.findOne(
      {
        id: userId
      },
      {
        gender: 1,
        username: 1,
        description: 1,
        display_name: 1
      }
    );

    return {
      gender: updateUserInfo.gender,
      username: updateUserInfo.username,
      description: updateUserInfo.description,
      display_name: updateUserInfo.display_name
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to update the user information");
    }

    throw err;
  }
};

/**
 * This functions search on the users collection by the username or display name of the account
 *
 * @param userId The user id
 * @param search The plain search text
 * @param page The page number in the pagination
 * @param limit The number of documents to limit in each pagination
 */
export const searchForUsers = async (
  userId: string,
  search?: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<UserSearchResult>> => {
  try {
    const query = [
      /* search for all the account that are not suspended and non-verified,
      but the username or the display name matches the text search */
      {
        $match: {
          $or: [
            {
              verified: true,
              suspended: false,
              username: {
                $options: "i",
                $regex: search
              }
            },
            {
              verified: true,
              suspended: false,
              display_name: {
                $options: "i",
                $regex: search
              }
            }
          ]
        }
      },

      // joining blocked_users collection on users collection and filtering result for all accounts that blocked the user
      {
        $lookup: {
          as: "blockers",
          from: "blocked_users",
          let: {
            user_id: userId,
            profile_user_id: "$id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$profile_user_id", "$user_id"] },
                    { $eq: ["$$user_id", "$blocked_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // joining users and followers collection and filtering the result for all accounts that the user follows
      {
        $lookup: {
          as: "followers",
          from: "followers",
          let: {
            user_id: userId,
            profile_user_id: "$id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$user_id", "$user_id"] },
                    { $eq: ["$$profile_user_id", "$following_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // constructing a document to be returned in the aggregation pipeline
      {
        $project: {
          id: 1,
          username: 1,
          photo_url: 1,
          display_name: 1,
          // if the user was blocked
          did_user_block: {
            $eq: [{ $size: "$blockers" }, 1]
          },
          // if the user is following the account
          is_following_user: {
            $eq: [{ $size: "$followers" }, 1]
          }
        }
      },

      // filtering all accounts that did not bloc
      {
        $match: {
          did_user_block: false
        }
      },

      // sorting all remainingg users that the user follows
      {
        $sort: {
          is_following_user: -1
        }
      },

      // removing any unneeded fields from each document
      {
        $project: {
          _id: 0,
          __v: 0,
          blocked_user: 0
        }
      }
    ];

    // performing aggration and return pagination result
    const paginationResult = await Pagination(userModel, page, limit, query);

    return {
      limit,
      next_page: paginationResult.next_page,
      result: paginationResult.result.map(profile => {
        // if the profile photo was an uploaded image then change the url
        if (profile.photo_url.startsWith("!")) {
          const url = new URL(HOST);
          url.pathname = `/api/user/profile/${profile.id}/photo`;
          profile.photo_url = url.href;
        }

        return profile;
      })
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to search and return pagination of of users");
    }

    throw err;
  }
};

/**
 * The function creates a new follower record that reprents the user following the account
 *
 * @param userId The id of the user
 * @param profileUserId The id of the account
 */
export const followUser = async (
  userId: string,
  profileUserId: string
): Promise<void> => {
  try {
    // checking if the user follows the account already
    const follower = await followerModel.findOne({
      user_id: userId,
      following_user_id: profileUserId
    });
    if (follower === null) {
      if (userId === profileUserId) {
        throw ErrorResponse(
          UserError.ACTION_DENIDED_EXECPTION,
          "you can not follow yourself",
          { http_code: 401 }
        );
      }

      // creating a new follower
      const newFollower = new followerModel({
        user_id: userId,
        following_user_id: profileUserId
      });

      await newFollower.save();
    }
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to insert a follower record into the followers collection"
        );
    }

    throw err;
  }
};

/**
 * This function deletes a follower record, a user that followed the other user
 *
 * @param userId The id of the user
 * @param profileUserId The id of the account
 */
export const unFollowUser = async (
  userId: string,
  profileUserId: string
): Promise<void> => {
  const status = await followerModel.deleteOne({
    user_id: userId,
    following_user_id: profileUserId
  });
  if (status.n === 0) {
    logger.warn(
      "Failed to delete record of follower from followers collection"
    );
  }
};

/**
 * This function preforms aggregation of the account followers
 *
 * @param userId The id of the user
 * @param profileUserId The id of the account
 * @param search The plain text search
 * @param page The page number in the pagination
 * @param limit The number of documents to return in the pagination
 */
export const getFollowers = async (
  userId: string,
  profileUserId: string,
  search?: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<UserSearchResult>> => {
  try {
    const query = [
      // all the followering_user_id's that match the profile user id
      {
        $match: {
          following_user_id: profileUserId
        }
      },

      // joining blocked_users on followers collection and filtering ones that have blocked the user
      {
        $lookup: {
          as: "blockers",
          from: "blocked_users",
          let: {
            user_id: userId,
            follower_user_id: "$user_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$user_id", "$user_id"] },
                    { $eq: ["$$follower_user_id", "$blocked_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // joining followers on followers collection and filtering followers that the user follows
      {
        $lookup: {
          as: "following",
          from: "followers",
          let: {
            user_id: userId,
            follower_user_id: "$user_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$user_id", "$user_id"] },
                    { $eq: ["$$follower_user_id", "$following_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // joining users.id on followers.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "user_id"
        }
      },

      // making the array field into a object instead
      {
        $unwind: "$users"
      },

      // contstructing a new document in the aggregation pipeline
      {
        $project: {
          id: "$users.id",
          verified: "$users.verified",
          username: "$users.username",
          suspended: "$users.suspended",
          photo_url: "$users.photo_url",
          display_name: "$users.display_name",
          // if the user is following the account
          is_following_user: {
            $eq: [{ $size: "$following" }, 1]
          },
          // the accounts that the user blocked
          did_user_block: {
            $eq: [{ $size: "$blockers" }, 1]
          }
        }
      },

      // filters accounts that nor supspended, non-verified, or is a blocked user account
      {
        $match: {
          verified: true,
          suspended: false,
          did_user_block: false
        }
      },

      // filtering the documents that match the username or display name text search
      {
        $match: {
          $or: [
            {
              username: {
                $options: "i",
                $regex: search
              }
            },
            {
              display_name: {
                $options: "i",
                $regex: search
              }
            }
          ]
        }
      },

      // sorting all the followers in the order that they followed the user
      {
        $sort: {
          followed_since: -1,
          is_following_user: 1
        }
      },

      // removing unneeded fields from each documents
      {
        $project: {
          _id: 0,
          __v: 0,
          verified: 0,
          suspended: 0,
          did_user_block: 0
        }
      }
    ];

    // preforming pagination and returning pagination result
    const paginationResult = await Pagination(
      followerModel,
      page,
      limit,
      query
    );

    return {
      limit,
      next_page: paginationResult.next_page,
      result: paginationResult.result.map(profile => {
        // // if the profile photo was an uploaded image the url
        if (profile.photo_url.startsWith("!")) {
          const url = new URL(HOST);
          url.pathname = `/api/user/profile/${profile.id}/photo`;
          profile.photo_url = url.href;
        }

        return profile;
      })
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to retrieve/aggregation of the users followers");
    }
    throw err;
  }
};

/**
 * This user functions returns all the record of all the accounts the user follows
 *
 * @param userId The id of the user
 * @param profileUserId The id of the account
 * @param search The plain text
 * @param page The page number in the pagination
 * @param limit The number of the documents to return in each pagination
 */
export const getFollowing = async (
  userId: string,
  profileUserId: string,
  search?: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<UserSearchResult>> => {
  try {
    const query = [
      // matching all follower records that the user has created
      {
        $match: {
          user_id: profileUserId
        }
      },

      // joining blocked_users on followers collection and filtering the collection if the account has blocked the user
      {
        $lookup: {
          as: "blockers",
          from: "blocked_users",
          let: {
            user_id: userId,
            follower_user_id: "$user_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$follower_user_id", "$user_id"] },
                    { $eq: ["$$user_id", "$blocked_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // joining followers on folloers collection and filtering all accounts the user is following
      {
        $lookup: {
          as: "following",
          from: "followers",
          let: {
            user_id: userId,
            follower_user_id: "$user_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$user_id", "$user_id"] },
                    { $eq: ["$$follower_user_id", "$following_user_id"] }
                  ]
                }
              }
            }
          ]
        }
      },

      // joining users.id on followers.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "following_user_id"
        }
      },

      // making the array field into a object instead
      {
        $unwind: "$users"
      },

      // constructing a new document in the aggregation pipeline
      {
        $project: {
          id: "$users.id",
          verified: "$users.verified",
          username: "$users.username",
          suspended: "$users.suspended",
          photo_url: "$users.photo_url",
          display_name: "$users.display_name",
          // if the user is following the account
          is_following_user: {
            $eq: [{ $size: "$following" }, 1]
          },
          // if the account blocked the user
          did_user_block: {
            $eq: [{ $size: "$blockers" }, 1]
          }
        }
      },

      // filtering all accounts username or display name match the search text
      {
        $match: {
          $or: [
            {
              username: {
                $options: "i",
                $regex: search
              }
            },
            {
              display_name: {
                $options: "i",
                $regex: search
              }
            }
          ]
        }
      },

      // filtering all accounts that are non-verified, suspeneded, and have blocked the user account
      {
        $match: {
          verified: true,
          suspended: false,
          did_user_block: false
        }
      },

      // sorting the aggregation by accounts when the user followed it
      {
        $sort: {
          followed_since: -1
        }
      },

      // removing unneeded fields from each document
      {
        $project: {
          _id: 0,
          __v: 0,
          verified: 0,
          suspended: 0,
          did_user_block: 0
        }
      }
    ];

    // preforming and returning aggregation
    const paginationResult = await Pagination(
      followerModel,
      page,
      limit,
      query
    );

    return {
      limit,
      next_page: paginationResult.next_page,
      result: paginationResult.result.map(profile => {
        // if the profile photo was an uploaded image the url
        if (profile.photo_url.startsWith("!")) {
          const url = new URL(HOST);
          url.pathname = `/api/user/profile/${profile.id}/photo`;
          profile.photo_url = url.href;
        }

        return profile;
      })
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to retrieve/aggregation of the users the user follows");
    }
    throw err;
  }
};

/**
 * The function create new blocked user record when a user wants to block another account
 *
 * @param userId The id of the user
 * @param profileUserId The id of account
 */
export const blockUser = async (
  userId: string,
  profileUserId: string
): Promise<void> => {
  try {
    // checkign if the user already blocked the account
    const blockedUser = await blockUserModel.findOne({
      user_id: userId,
      blocked_user_id: profileUserId
    });
    if (blockedUser === null) {
      if (userId === profileUserId) {
        throw ErrorResponse(
          UserError.ACTION_DENIDED_EXECPTION,
          "you cna not block yourself",
          { http_code: 401 }
        );
      }

      // create a new blcoked user record
      const newBlockedUser = new blockUserModel({
        user_id: userId,
        blocked_user_id: profileUserId
      });

      await newBlockedUser.save();

      // deletes any follower record that the user might have created
      const status = await followerModel.deleteOne({
        user_id: userId,
        following_user_id: profileUserId
      });
      if (status.ok && status.n === 0) {
        logger.error("Failed to delete follower record after blocking user");
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to insert record of blocked user in blocked_users collection"
        );
    }

    throw err;
  }
};

/**
 * The delets the blocked user record from the blocked users collection
 *
 * @param userId The id of the user
 * @param profileUserId The id of the account
 */
export const unBlockUser = async (
  userId: string,
  profileUserId: string
): Promise<void> => {
  const status = await blockUserModel.deleteOne({
    user_id: userId,
    blocked_user_id: profileUserId
  });
  if (status.n === 0) {
    logger.warn(
      "Failed to delete record of blocked user in blocked_users collection"
    );
  }
};

/**
 * This function returns a aggregated list of the all the accounts the user blocked
 *
 * @param userId The id of the user
 */
export const getBlockedUsers = async (
  userId: string
): Promise<BlockedUserAggregation[]> => {
  try {
    return await blockUserModel.aggregate([
      // getting all the records the user created
      {
        $match: {
          user_id: userId
        }
      },

      // joining blocked_users.blocked_user_id on users.id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "blocked_user_id"
        }
      },

      // undoing the array field into a object
      {
        $unwind: "$users"
      },

      // constructing a new document in the aggregation pipeline
      {
        $project: {
          id: "$users.id",
          username: "$users.username",
          photo_url: "$users.photo_url",
          display_name: "$users.display_name"
        }
      },

      // sorting the list of blocked users in descending order
      {
        $sort: {
          blocked_since: -1
        }
      },

      // removing unneeded fields from each document
      {
        $project: {
          _id: 0,
          __v: 0
        }
      }
    ]);
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to retrieve/aggregationg of blocked users information from blocked_users collection"
        );
    }
    throw err;
  }
};
