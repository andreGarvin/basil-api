// models
import directMessageMemberModel from "./member/models/direct-message-member";
import workspaceMemberModel from "../workspace/member/model";
import groupMemberModel from "./member/models/group-member";
import directMessageModel from "./models/direct-message";
import userModel from "../authentication/model";
import groupModel from "./models/group";

// modules
import * as messengerMember from "./member/index";

// utils
import Pagination from "../../common/utils/pagination";
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";

// error codes
import WorkspaceMemberError from "../workspace/member/error-codes";
import { GroupError, DirectMessageError } from "./error-codes";

// types
import {
  Group,
  DirectMessage,
  GroupSearchResult,
  AggregatedGroupInfo,
  AggregatedDirectMessageInfo
} from "./types";

// resources
import { PaginationResults } from "../../types";
import { words, catBreeds } from "./resources";

// this is the main channel name for workspace
export const DEFAULT_MAIN_CHANNEL_NAME: string = "general";

/**
 * This function creates a new channel in the groups collection
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param name The name of the channel
 * @param description The boi description of the chanenl
 */
export const createChannel = async (
  userId: string,
  workspaceId: string,
  name: string,
  description?: string
): Promise<Group> => {
  try {
    // checking if the channel exist in the groups collection
    const channel = await groupModel.findOne({
      name: {
        $options: "i",
        $regex: name
      },
      is_channel: true,
      workspace_id: workspaceId
    });
    if (channel) {
      let errorMessage = "this channel already exist";
      if (channel.archived) {
        errorMessage = "this channel already exists but has archived";
      }

      throw ErrorResponse(GroupError.GROUP_EXIST_EXCEPTION, errorMessage, {
        http_code: 400
      });
    }

    // creating a new 'channel'
    const newChannel = new groupModel({
      name,
      description,
      creator: userId,
      is_channel: true,
      is_private: false,
      workspace_id: workspaceId
    });

    // inserting the new channel into groups collection
    await newChannel.save();

    return {
      id: newChannel.id,
      name: newChannel.name,
      creator: newChannel.creator,
      archived: newChannel.archived,
      is_private: newChannel.is_private,
      is_channel: newChannel.is_channel,
      created_at: newChannel.created_at,
      description: newChannel.description,
      workspace_id: newChannel.workspace_id
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create workspace channel");
    }

    throw err;
  }
};

/**
 * This function creates a new direct message in the direct_messages
 * collection
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param name The name of the channel
 * @param description The boi description of the chanenl
 */
export const createDirectMessage = async (
  userId: string,
  workspaceId: string,
  memberUserId: string
): Promise<DirectMessage> => {
  try {
    // the members in the direct message
    const members = [userId];

    if (userId !== memberUserId) {
      // checking if the other member is a user of the workspace
      const memberInfo = await workspaceMemberModel.findOne({
        user_id: memberUserId,
        workspace_id: workspaceId
      });
      if (memberInfo === null || memberInfo.removed) {
        throw ErrorResponse(
          WorkspaceMemberError.WORKSPACE_MEMBER_NOT_FOUND_EXCEPTION,
          "this workspace member does not exist",
          { http_code: 400 }
        );
      }

      members.push(memberUserId);
    }

    // checking if the direct message already exist
    const directMessage = await directMessageModel.findOne({
      members: {
        // matching all elements in the array, reagrdless of order
        $all: members
      },
      workspace_id: workspaceId
    });
    if (directMessage) {
      let errorMessage = "this direct message exist";
      if (directMessage.archived) {
        errorMessage = "this direct message exist but has archived";
      }

      throw ErrorResponse(
        DirectMessageError.DIRECT_MESSAGE_EXIST_EXCEPTION,
        errorMessage,
        { http_code: 400 }
      );
    }

    // creating a new direct message
    const newDirectMessage = new directMessageModel({
      members,
      workspace_id: workspaceId
    });

    // saving a new direct message into the direct messages collection
    await newDirectMessage.save();

    return {
      members,
      id: newDirectMessage.id,
      is_direct_message: true,
      archived: newDirectMessage.archived,
      created_at: newDirectMessage.created_at,
      workspace_id: newDirectMessage.workspace_id
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create direct message");
    }

    throw err;
  }
};

/**
 * This function creates a new group in the groups collection
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param name The name of the channel
 * @param description The boi description of the chanenl
 */
export const createGroup = async (
  userId: string,
  workspaceId: string,
  name: string,
  isPrivate?: boolean,
  description?: string
): Promise<Group> => {
  try {
    // checking if the group exist
    const group = await groupModel.findOne({
      name: {
        $regex: name,
        $options: "i"
      },
      is_channel: false,
      workspace_id: workspaceId
    });
    if (group) {
      let errorMessage = "this group already exist";
      if (group.archived) {
        errorMessage = "this group already exists but has archived";
      }

      throw ErrorResponse(GroupError.GROUP_EXIST_EXCEPTION, errorMessage, {
        http: 400
      });
    }

    // creating a new 'channel'
    const newGroup = new groupModel({
      name,
      description,
      creator: userId,
      is_private: isPrivate,
      workspace_id: workspaceId
    });

    // inserting the new channel into groups collection
    await newGroup.save();

    return {
      id: newGroup.id,
      name: newGroup.name,
      creator: newGroup.creator,
      archived: newGroup.archived,
      is_private: newGroup.is_private,
      is_channel: newGroup.is_channel,
      created_at: newGroup.created_at,
      description: newGroup.description,
      workspace_id: newGroup.workspace_id
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create workspace group");
    }

    throw err;
  }
};

// This function creates the random name/title
const retrunRandomTitle = () => {
  let randomTitle = [
    // getting a random name from the cats breads array
    catBreeds[Math.floor(Math.random() * catBreeds.length)],
    // getting a random name from the words array
    words[Math.floor(Math.random() * words.length)],
    "cats"
  ];

  // this to make the name more random, this will randomly switch the order of the random cat breed and word
  if (Math.floor(Math.random() * 2) === 1) {
    randomTitle = [...randomTitle.slice(0, 1).reverse(), "cats"];
  }

  return randomTitle.join(" ");
};

/**
 * This function generates a random name for a channel or group
 *
 * @param workspaceId The id of the workspace
 * @param isChannel Weatehr or not it is for a channel or group
 */
export const feelingLucky = async (
  workspaceId: string,
  isChannel?: boolean
): Promise<string> => {
  try {
    // create a inital random name
    let randomGroupName = retrunRandomTitle();
    // limiting the number tries to generate a random name
    let retries = 0;

    let nameAvailable: boolean = false;
    while (!nameAvailable) {
      // checking if the channel/group exist in the workspace
      const group = await groupModel.findOne({
        name: {
          $options: "i",
          $regex: randomGroupName
        },
        workspace_id: workspaceId,
        is_channel: isChannel || false
      });
      if (group) {
        // if it is the fourth time then just add a 's' to the name/title
        if (retries === 10) {
          logger
            .child({
              name: {
                $options: "i",
                $regex: randomGroupName
              },
              workspace_id: workspaceId,
              is_channel: isChannel || false
            })
            .warn("Failed to generate random name for group");

          throw ErrorResponse(
            GroupError.GROUP_NAME_MACHINE_IS_BROKEN_EXCEPTION,
            "seems like the machine is broken, try again",
            { http_code: 400 }
          );
        }

        retries++;
        randomGroupName = retrunRandomTitle();
      } else {
        nameAvailable = true;
      }
    }

    return randomGroupName;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to create random group/channel name");
    }

    throw err;
  }
};

/**
 * This function returns a pagination search result of groups and channels that matches
 * search provided
 *
 * #TODO: Filter the groups that are private and that the user is a member of
 *
 * @param userId The workspace member user id
 * @param workspaceId The id of the workspace
 * @param search The name of the group or channel
 * @param page The page number in the pagination
 * @param limit The number of documents to return in the pagination
 */
export const searchForGroups = async (
  userId: string,
  workspaceId: string,
  search?: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<GroupSearchResult>> => {
  try {
    const query = [
      {
        $match: {
          workspace_id: workspaceId,
          name: {
            $options: "i",
            $regex: search
          }
        }
      },
      {
        $lookup: {
          as: "group_members",
          from: "group_members",
          let: {
            id: "$id",
            user_id: userId,
            workspace_id: workspaceId
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  group_id: "$$id",
                  user_id: "$$user_id",
                  workspace_id: "$$workspace_id"
                }
              }
            }
          ]
        }
      },
      {
        $match: {
          $or: [
            {
              is_channel: true
            },
            {
              group_members: {
                $eq: [{ $size: "$group_members" }, 1]
              }
            }
          ]
        }
      },
      {
        $unwind: {
          path: "group_members",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          as: "workspace_members",
          from: "workspace_members",
          let: {
            user_id: userId,
            workspace_id: workspaceId
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  group_id: "$$id",
                  user_id: "$$user_id",
                  workspace_id: "$$workspace_id"
                }
              }
            }
          ]
        }
      },
      {
        $unwind: "$workspace_members"
      },
      {
        $project: {
          id: 1,
          name: 1,
          archived: 1,
          is_channel: 1,
          is_private: 1,
          created_at: 1,
          description: 1,
          workspace_id: 1,
          meta: {
            is_admin: {
              $ifNull: [
                "$group_members.is_admin",
                "$workspace_members.is_admin"
              ]
            },
            // is_member: {
            //   $cond: [
            //     {},

            //   ]
            // },
            is_creator: {
              $eq: ["$creator", userId]
            }
          }
        }
      }
    ];

    const paginationResult = await Pagination(groupModel, page, limit, query);

    return {
      limit,
      search,
      result: paginationResult.result,
      next_page: paginationResult.next_page
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to create random group/channel name");
    }

    throw err;
  }
};

// #TODO: implement functions logic when working on message/member
export const archiveGroup = async (
  userId: string,
  groupId: string
): Promise<boolean> => {
  try {
    const group = await groupModel.findOne(
      {
        id: groupId,
        creator: userId
      },
      {
        archived: 1
      }
    );
    if (group === null) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION,
        "only the creator of this workspace can archive this group"
      );
    }

    const status = await groupModel.updateOne(
      { id: groupId },
      {
        $set: {
          archived: !group.archived
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        group_id: groupId
      });

      logger.child(fields).debug("debugging update query");

      throw new Error(
        "Internal server error, failed to update the group to archived"
      );
    }

    return !group.archived;
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to archive the group");
    }

    throw err;
  }
};

export const getGroupInfo = async (
  userId: string,
  groupId: string
): Promise<AggregatedGroupInfo> => {
  try {
    const groupInfo = await groupModel.findOne(
      {
        id: groupId
      },
      {
        id: 1,
        name: 1,
        creator: 1,
        archived: 1,
        created_at: 1,
        is_private: 1,
        is_channel: 1,
        description: 1,
        workspace_id: 1
      }
    );

    let isGroupAdmin: boolean;
    if (groupInfo.is_channel) {
      const workspaceMemberInfo = await workspaceMemberModel.findOne(
        {
          user_id: userId
        },
        {
          is_admin: 1
        }
      );

      isGroupAdmin = workspaceMemberInfo.is_admin;
    } else {
      const groupMemberInfo = await groupMemberModel.findOne(
        {
          user_id: userId
        },
        {
          is_admin: 1
        }
      );

      isGroupAdmin = groupMemberInfo.is_admin;
    }

    return {
      id: groupInfo.id,
      name: groupInfo.name,
      creator: groupInfo.creator,
      archived: groupInfo.archived,
      created_at: groupInfo.created_at,
      is_private: groupInfo.is_private,
      is_channel: groupInfo.is_channel,
      description: groupInfo.description,
      workspace_id: groupInfo.workspace_id,
      meta: {
        is_admin: isGroupAdmin,
        is_creator: groupInfo.creator === userId
      }
    };
  } catch (err) {
    logger.child({ error: err }).error("Failed to get group info");

    throw err;
  }
};

export const getDirectMessageInfo = async (
  userId: string,
  directMessageId: string
): Promise<AggregatedDirectMessageInfo> => {
  try {
    const directMessageInfo = await directMessageModel.findOne(
      {
        id: directMessageId
      },
      {
        id: 1,
        archived: 1,
        created_at: 1,
        workspace_id: 1
      }
    );

    const member = await directMessageMemberModel.findOne(
      {
        user_id: {
          $not: {
            $eq: userId
          }
        },
        direct_message_id: directMessageInfo.id,
        workspace_id: directMessageInfo.workspace_id
      },
      { user_id: 1 }
    );
    if (member) {
      throw new Error(
        "Failed to fetch the other user direct message information"
      );
    }

    const workspaceMemberInfo = await workspaceMemberModel.findOne(
      {
        user_id: member.user_id
      },
      {
        status: 1,
        is_admin: 1
      }
    );

    const userInfo = await userModel.findOne(
      {
        id: member.user_id
      },
      {
        email: 1,
        last_name: 1,
        photo_url: 1,
        first_name: 1
      }
    );

    return {
      id: directMessageInfo.id,
      archived: directMessageInfo.archived,
      created_at: directMessageInfo.created_at,
      workspace_id: directMessageInfo.workspace_id,
      member: {
        email: userInfo.email,
        photo_url: userInfo.photo_url,
        status: workspaceMemberInfo.status,
        is_active: workspaceMemberInfo.is_active,
        is_workspace_admin: workspaceMemberInfo.is_admin,
        name: `${userInfo.first_name} ${userInfo.last_name}`
      }
    };
  } catch (err) {
    logger.child({ error: err }).error("Failed to get direct message info");

    throw err;
  }
};

export const getGroups = async (
  userId: string,
  workspaceId: string
): Promise<void> => {
  try {
    const;
  } catch (err) {
    logger
      .child({ error: err })
      .error("Failed to return the list of groups the user is a member of");
  }
};
