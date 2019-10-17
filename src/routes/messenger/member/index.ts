// models
import directMessageMemberModel from "./models/direct-message-member";
import workspaceMemberModel from "../../workspace/member/model";
import directMessageModel from "../models/direct-message";
import groupMemberModel from "./models/group-member";
import groupModel from "../models/group";

// utils
import logger from "../../../common/logger";

export const joinGroup = async (
  userId: string,
  groupId: string
): Promise<void> => {};
export const leaveGroup = async (
  userId: string,
  groupId: string
): Promise<void> => {};
export const getMembers = async (
  groupId: string,
  page?: number,
  limit?: number
): Promise<void> => {};
export const removeMember = async (
  groupId: string,
  memberUserId: string
): Promise<void> => {};
export const addMemberBulk = async (
  groupId: string,
  members: string[]
): Promise<void> => {};
export const searchForMembers = async (
  groupId: string,
  search?: string,
  page?: number,
  limit?: number
): Promise<void> => {};
export const updateMemberPermission = async (
  groupId: string,
  memberUserId: string
): Promise<void> => {};

// there are internal functions that are used by other modules not consumed by api endpoints
export const unRemoveMemberFromAllGroups = async (
  workspaceId: string,
  memberUserId: string
): Promise<void> => {
  try {
    const memberGroups: {
      group_id: string;
    }[] = await groupMemberModel.aggregate([
      {
        $match: {
          removed: true,
          user_id: memberUserId,
          workspace_id: workspaceId
        }
      },
      {
        $lookup: {
          as: "groups",
          from: "groups",
          pipeline: [
            {
              $match: {
                $expr: {
                  id: "$group_id",
                  archived: false,
                  is_private: false
                }
              }
            }
          ]
        }
      },
      {
        $unwind: "$groups"
      },
      {
        $project: {
          group_id: "$groups.id"
        }
      }
    ]);

    // all remove the member from all groups in the workspace
    await groupMemberModel.updateMany(
      {
        user_id: memberUserId,
        group_id: {
          $in: memberGroups.map(memberInfo => memberInfo.group_id)
        }
      },
      {
        $set: {
          removed: false
        }
      }
    );
  } catch (err) {
    logger
      .child({
        error: err
      })
      .error("Failed to un remove memebr from all groups in the workspace");

    throw err;
  }
};

export interface PartialGroupMemberInfo {
  group_id: string;
  is_creator: boolean;
}
export const removeMemberFromAllGroups = async (
  workspaceId: string,
  memberUserId: string
): Promise<void> => {
  try {
    const memberGroups: PartialGroupMemberInfo[] = await groupMemberModel.aggregate(
      [
        {
          $match: {
            removed: false,
            user_id: memberUserId,
            workspace_id: workspaceId
          }
        },
        {
          $lookup: {
            as: "groups",
            from: "groups",
            pipeline: [
              {
                $match: {
                  $expr: {
                    id: "$group_id",
                    archived: false
                  }
                }
              }
            ]
          }
        },
        {
          $unwind: "$groups"
        },
        {
          $project: {
            group_id: "$groups.id",
            is_creator: {
              $eq: ["$groups.creator", "$user"]
            }
          }
        }
      ]
    );

    // gathering all the group ids
    const groups: string[] = memberGroups.map(
      memberInfo => memberInfo.group_id
    );

    // all remove the member from all groups in the workspace
    await groupMemberModel.updateMany(
      {
        user_id: memberUserId,
        group_id: {
          $in: groups
        }
      },
      {
        $set: { removed: true }
      }
    );

    // all the groups the user is a owner of
    const ownedGroups: string[] = memberGroups
      .filter(memberInfo => memberInfo.is_creator)
      .map(memberInfo => memberInfo.group_id);

    // archiving all the groups the member is a owner/creator of
    await groupModel.updateMany(
      {
        is_private: true,
        user_id: memberUserId,
        group_id: {
          $in: ownedGroups
        }
      },
      {
        $set: {
          archived: true
        }
      }
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error("Failed to remove member from all groups in the workspace");

    throw err;
  }
};

interface DirectMessageIds {
  id: string;
}
export const archiveAllMemberDirectMessages = async (
  workspaceId: string,
  memberUserId: string,
  archiveDirectMessages: boolean
): Promise<void> => {
  try {
    const directMessages: DirectMessageIds[] = await directMessageMemberModel.aggregate(
      [
        {
          $match: {
            user_id: memberUserId,
            workspace_id: workspaceId
          }
        },
        {
          $lookup: {
            as: "direct_messages",
            from: "direct_messages",
            let: {
              direct_message_id: "$direct_message_id"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    id: "$$direct_message_id",
                    archived: !archiveDirectMessages
                  }
                }
              }
            ]
          }
        },
        {
          $unwind: "$direct_messages"
        },
        {
          $project: {
            id: "$direct_messages.id"
          }
        }
      ]
    );

    await directMessageModel.updateMany(
      {
        id: {
          $in: directMessages
        }
      },
      {
        $set: {
          archived: archiveDirectMessages
        }
      }
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Failed to archive all direct messages the user has in the workspace"
      );

    throw err;
  }
};
