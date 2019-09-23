// models
import workspaceMemberRequestModel from "./request/model";
import workspaceMemberModel from "./member/model";
import userModel from "../authentication/model";
import workspaceModel from "./model";

// module
import { InvitationRoles } from "../invitation";

// config
import { CHARACTER_LIMIT } from "../../config";

// utils
import Pagination from "../../common/utils/pagination";
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";

// error codes
import AuthenticationError from "../authentication/error-codes";
import WorkspaceError from "./error-codes";

// types
import { PaginationResults } from "../../types";
import {
  UpdateWorkspaceInfoParameters,
  AggregatedWorkspaceInfo,
  UpdatedWorkspaceInfo,
  NewWorkspaceInfo
} from "./types";

// the different workspace types
export enum WorkspaceTypes {
  class = "class",
  club = "club"
}

// the different workspace scopes
export enum WorkspaceScopes {
  private = "private",
  public = "public"
}

/**
 * This function return the information on the workspace from the workspace collection.
 * But also return addiional information of the workspace based on the user
 *
 * @param userId The user id
 * @param workspaceId The id of the workspace
 */
export const getWorkspace = async (userId: string, workspaceId: string) => {
  try {
    // fetching the workspace data
    const workspace = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        id: 1,
        name: 1,
        type: 1,
        scope: 1,
        section: 1,
        creator: 1,
        archived: 1,
        created_at: 1,
        description: 1
      }
    );

    // getting the user's workspace member information
    const workspaceMember = await workspaceMemberModel.findOne(
      {
        user_id: userId,
        workspace_id: workspaceId
      },
      {
        status: 1,
        is_admin: 1,
        is_active: 1,
        last_active_at: 1
      }
    );

    // fetching the informatin of the workspace's main channel
    // const workspaceGeneralChannel = await chatModel.findOne(
    //   {
    //     is_channel: true,
    //     workspace_id: workspace.id,
    //     name: MAIN_WORKSPACE_CHANNEL
    //   },
    //   // only returning the id of the channel
    //   {
    //     id: 1
    //   }
    // );
    // if (workspaceGeneralChannel === null) {
    //   logger
    //     .addFields({
    //       workspace_id: workspace.id,
    //       name: MAIN_WORKSPACE_CHANNEL
    //     })
    //     .error(
    //       "Internal server error the general channel for the workspace was not found"
    //     );

    //   throw new Error(
    //     "Internal server error the general channel for the workspace was not found"
    //   );
    // }

    // workspace information and meta data returned
    return {
      // the id of the workspace
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      scope: workspace.scope,
      section: workspace.section,
      archived: workspace.archived,
      created_at: workspace.created_at,
      description: workspace.description,
      // the id of the workspace's main channel
      // main_channel_id: workspaceGeneralChannel.id,
      // this is a field that holds the member's information related to the workspace
      meta: {
        // the user's activity status in the workspace
        status: workspaceMember.status,
        is_admin: workspaceMember.is_admin,
        // This is a boolean value that indicates weather the user is active in this workspace or not
        is_active: workspaceMember.is_active,
        is_creator: workspace.creator === userId,
        last_active_at: workspaceMember.last_active_at
        // last_chat_id: workspaceMember.last_chat_id,
      }
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to retrieve workspace information");
    }

    throw err;
  }
};

/**
 * This function returns a aggregated list of all the workspaces the user is a member
 *
 * @param userId The user id
 */
export const getUserWorkspaces = async (userId: string) => {
  try {
    // This is a pipeline aggregation of all the workspaces the user is a member of and there member information
    return await workspaceMemberModel.aggregate([
      // matches documents with the same user id in the 'workspace_memebrs' collection
      {
        $match: { user_id: userId, removed: false }
      },
      // constructing a the documents
      {
        $project: {
          // This holds all the member's meta information
          workspace_id: 1,
          meta: {
            status: "$status",
            is_admin: "$is_admin",
            joined_at: "$joined_at",
            is_active: "$is_active",
            last_chat_id: "$last_chat_id",
            last_active_at: "$last_active_at"
          }
        }
      },
      // join 'workspace_members.workspace_id' on 'workspaces.id'
      {
        $lookup: {
          as: "workspaces",
          from: "workspaces",
          foreignField: "id",
          localField: "workspace_id"
        }
      },
      {
        $match: { "workspaces.archived": false }
      },
      // separating the arrays of 'workspaces' documets into individual documents
      {
        $unwind: {
          path: "$workspaces"
        }
      },
      // replacing the root for each document with the 'workspaces' field
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$$ROOT.workspaces", "$$ROOT"]
          }
        }
      },
      // removing fields on the documents
      {
        $project: {
          workspaces: 0,
          workspace_id: 0
        }
      },
      // constructing a new docment
      {
        $project: {
          // the id of the workspace
          id: 1,
          name: 1,
          type: 1,
          scope: 1,
          section: 1,
          archived: 1,
          created_at: 1,
          description: 1,
          meta: {
            status: 1,
            is_admin: 1,
            is_active: 1,
            joined_at: 1,
            // last_chat_id: 1,
            last_active_at: 1,
            // conditional checking if the user is the same as the 'workspace.creator' user id
            is_creator: {
              $eq: ["$creator", userId]
            }
          }
        }
      },
      // joining 'chats.workspace_id' on 'workspace.id'
      // {
      //   $lookup: {
      //     from: "chats",
      //     as: "channels",
      //     localField: "id",
      //     foreignField: "workspace_id"
      //   }
      // },
      // seperate the array 'channels' into individual documents
      // {
      //   $unwind: {
      //     path: "$channels"
      //   }
      // },
      // only matching all chats that are channels and match the main channel name for workspaces
      // {
      //   $match: {
      //     "channels.is_channel": true,
      //     "channels.name": MAIN_WORKSPACE_CHANNEL
      //   }
      // },
      // constructing a new document
      // {
      //   $project: {
      //     // the id of the workspace
      //     id: 1,
      //     name: 1,
      //     type: 1,
      //     meta: 1,
      //     scope: 1,
      //     section: 1,
      //     archived: 1,
      //     created_at: 1,
      //     description: 1,
      //     main_channel_id: "$channels.id"
      //   }
      // },
      // removing unwanted fields on the documents
      {
        $project: {
          __v: 0,
          _id: 0,
          creator: 0
        }
      }
    ]);
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to fetch user workspaces");
    }

    throw err;
  }
};

/**
 * This function creates/inserts a new workspace into the workspaces collection
 *
 * @param userId The user id
 * @param newWorkspaceParamters The new information for creating the workspace
 */
export const createWorkspace = async (
  userId: string,
  newWorkspaceParamters: NewWorkspaceInfo
): Promise<AggregatedWorkspaceInfo> => {
  try {
    // fetching the user information
    const user = await userModel.findOne(
      { id: userId },
      // only returning the the need information
      {
        id: 1,
        role: 1,
        school_id: 1
      }
    );

    // checking the user's role
    if (user.role === InvitationRoles.STUDENT) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_ROLE_PREMISSION_EXCEPTION,
        "you do not have premission to create a workspace",
        { http_code: 401 }
      );
    }

    // if the workspace type was not provided
    if (!newWorkspaceParamters.type) {
      newWorkspaceParamters.type = WorkspaceTypes.class;
    }

    // the sectio fo the class needs to be sent
    if (newWorkspaceParamters.type === WorkspaceTypes.class) {
      if (!newWorkspaceParamters.section) {
        throw ErrorResponse(
          WorkspaceError.WORKSPACE_SECTION_EXECPTION,
          "You must provide a section for the class",
          { http_code: 400 }
        );
      }
    } else if (newWorkspaceParamters.type === WorkspaceTypes.club) {
      // if the workspace is a club then just set it to null
      newWorkspaceParamters.section = "";
    }

    // checking the character length of the description
    if (
      newWorkspaceParamters.description &&
      newWorkspaceParamters.description.length > CHARACTER_LIMIT
    ) {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_DESCRIPTION_CHARACTER_LIMIT,
        "the description of the workspace can not be greater then 130 characters",
        { http_code: 400 }
      );
    }

    // matches the all names from beginning to end and extact match
    const regexp: RegExp = new RegExp(`^${newWorkspaceParamters.name}$`);

    // checking if the workspace already exist under the same user
    const workspace = await workspaceModel.findOne({
      $or: [
        {
          creator: user.id,
          school_id: user.school_id,
          type: newWorkspaceParamters.type,
          scope: newWorkspaceParamters.scope,
          section: newWorkspaceParamters.section,
          name: {
            $options: "i",
            $regex: regexp
          }
        },
        {
          creator: user.id,
          school_id: user.school_id,
          type: newWorkspaceParamters.type,
          scope: newWorkspaceParamters.scope,
          name: {
            $options: "i",
            $regex: regexp
          }
        }
      ]
    });
    if (workspace) {
      if (workspace.archived) {
        throw ErrorResponse(
          WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION,
          `this ${workspace.type} under your ownership but has been archived`,
          { http_code: 403 }
        );
      }

      throw ErrorResponse(
        WorkspaceError.WORKSPACE_EXIST_EXCEPTION,
        `it seems like ${workspace.name} already exist under your ownership`,
        { http_code: 400 }
      );
    }

    // creating a new workspace to insert in to the 'workspaces' collection
    const newWorkspace = new workspaceModel({
      creator: user.id,
      school_id: user.school_id,
      name: newWorkspaceParamters.name,
      type: newWorkspaceParamters.type,
      scope: newWorkspaceParamters.scope,
      section: newWorkspaceParamters.section,
      description: newWorkspaceParamters.description
    });

    // inserting the new workspace info into the 'workspaces' collection
    await newWorkspace.save();

    // creating and inserting the new workspace member into the 'workspace_members' collection
    const member = new workspaceMemberModel({
      is_admin: true,
      user_id: user.id,
      workspace_id: newWorkspace.id
    });

    // inserting the new workspace member info into the 'workspace_members' collection
    await member.save();

    return {
      id: newWorkspace.id,
      name: newWorkspace.name,
      type: newWorkspace.type,
      scope: newWorkspace.scope,
      section: newWorkspace.section,
      creator: newWorkspace.creator,
      archived: newWorkspace.archived,
      created_at: newWorkspace.created_at,
      description: newWorkspace.description
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create workspace");
    }

    throw err;
  }
};

/**
 * This function updates the workspace to be archived
 *
 * @param userId The user id
 * @param workspaceId The id of the workspace
 */
export const archiveWorkspace = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  try {
    // fetching the user information
    const user = await userModel.findOne(
      { id: userId },
      {
        id: 1,
        role: 1
      }
    );

    // fetching the workspace information
    const workspace = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        id: 1,
        creator: 1,
        archived: 1
      }
    );

    // if the user is a admin of the school or the workspace creator
    const authorized =
      user.role === InvitationRoles.ADMIN || workspace.creator === user.id;

    if (!authorized) {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION,
        "you are not a admin of the school or the our of this workspace",
        { http_code: 401 }
      );
    }

    // archiving the workspace archive
    const status = await workspaceModel.updateOne(
      {
        id: workspace.id
      },
      {
        $set: {
          archived: !workspace.archived
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        id: workspace.id
      });

      logger.child(fields).debug("inspecting information");

      throw new Error("Failed to update the workspace to be archived");
    }

    return !workspace.archived;
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to archive the workspace");
    }

    throw err;
  }
};

/**
 * This function updates the workspace information in the workspaces collection
 *
 * @param userId The user id
 * @param workspaceId The id of the workspace
 * @param updateWorkspaceInfoParameters The parameters of infortion the update about the workspace
 */
export const updateWorkspaceInfo = async (
  userId: string,
  workspaceId: string,
  updateWorkspaceInfoParameters: UpdateWorkspaceInfoParameters
): Promise<UpdatedWorkspaceInfo> => {
  try {
    // getting the workspace information
    const workspace = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        id: 1,
        name: 1,
        type: 1,
        scope: 1,
        section: 1,
        archived: 1,
        school_id: 1,
        description: 1
      }
    );

    // the workspace information that will be updated
    const workspaceInfo = {
      name: workspace.name,
      type: workspace.type,
      scope: workspace.scope,
      section: workspace.section,
      description: workspace.description
    };
    // getting all the fields of workspace information that will be updated
    const keys = Object.keys(workspaceInfo);
    keys.forEach((key: string) => {
      /* if the any of the fields are empty/undefined then it default to the
        workspace information that was already saved */
      workspaceInfo[key] =
        updateWorkspaceInfoParameters[key] || workspaceInfo[key];
    });

    // checking the workspace description character length
    if (
      workspaceInfo.description &&
      workspaceInfo.description.length > CHARACTER_LIMIT
    ) {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_DESCRIPTION_CHARACTER_LIMIT,
        "the description of the workspace can not be greater then 130 characters",
        { http_code: 400 }
      );
    }

    // regular expression for finding a workspace with the same name
    const regexp: RegExp = new RegExp(`^${workspaceInfo.name}$`);

    // checking if the workspace exist already under the same user
    const similarWorkspace = await workspaceModel.findOne({
      name: {
        $options: "i",
        $regex: regexp
      },
      school_id: workspace.school_id,
      section: workspaceInfo.section,
      scope: workspaceInfo.scope,
      type: workspaceInfo.type,
      creator: userId
    });
    if (similarWorkspace) {
      if (similarWorkspace.archived) {
        throw ErrorResponse(
          WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION,
          `this ${similarWorkspace.type} under your ownership but has been archived`,
          { http_code: 403 }
        );
      }

      throw ErrorResponse(
        WorkspaceError.WORKSPACE_EXIST_EXCEPTION,
        `it seems like ${similarWorkspace.name} already exist under your ownership`,
        { http_code: 400 }
      );
    }

    // update the workspace information
    const status = await workspaceModel.updateOne(
      {
        id: workspace.id,
        creator: userId
      },
      {
        $set: workspaceInfo
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, workspaceInfo, {
        id: workspaceId,
        creator: userId
      });

      logger.child(fields).error("inspecting information");

      throw new Error(
        "Internal server error, failed to update workspace information"
      );
    }

    // returning the updated workspace information
    return workspaceInfo;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to update the workspace information");
    }

    throw err;
  }
};

/**
 * This function returns a pgaination search result of the workspaces stored
 * in the workspaces collecition.
 *
 * @param userId The user id
 * @param search The search text
 * @param page The page number of the pagination
 * @param limit The number of documents to return in the pagination
 */
export const searchForWorkspaces = async (
  userId: string,
  search: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<any>> => {
  try {
    const user = await userModel.findOne(
      { id: userId },
      {
        school_id: 1
      }
    );

    // gathering all the workspace the user is a member in
    const workspaceIds = (await workspaceMemberModel.find(
      {
        removed: false,
        user_id: userId
      },
      {
        workspace_id: 1
      }
    )).map(memberInfo => memberInfo.workspace_id);

    // gathering all the workspace member request the user has sent
    const memberRequestWorkspaceIds = (await workspaceMemberRequestModel.find({
      user_id: userId
    })).map(memberRequestInfo => memberRequestInfo.workspace_id);

    // creating a regex for the search
    const regexpNameSearch: RegExp = new RegExp(`^${search}`);

    const query = [
      {
        $match: {
          archived: false,
          school_id: user.school_id,
          name: {
            $options: "i",
            $regex: regexpNameSearch
          }
        }
      },
      {
        $project: {
          id: 1,
          name: 1,
          type: 1,
          scope: 1,
          section: 1,
          creator: 1,
          created_at: 1,
          description: 1,
          meta: {
            sent_request: {
              $cond: [
                {
                  $in: ["$id", memberRequestWorkspaceIds]
                },
                true,
                false
              ]
            },
            is_member: {
              $cond: [
                {
                  $in: ["$id", workspaceIds]
                },
                true,
                false
              ]
            }
          }
        }
      },
      {
        $match: {
          $or: [
            // if the user is a member of the private workspace
            {
              "meta.is_member": true,
              scope: WorkspaceScopes.private
            },
            // any workspace that is public the user may or may not be a member of
            {
              scope: WorkspaceScopes.public
            }
          ]
        }
      },
      {
        $lookup: {
          from: "users",
          foreignField: "id",
          as: "creator_info",
          localField: "creator"
        }
      },
      {
        $unwind: "$creator_info"
      },
      {
        $lookup: {
          localField: "id",
          as: "workspace_members",
          from: "workspace_members",
          foreignField: "workspace_id"
        }
      },
      {
        $project: {
          id: 1,
          meta: 1,
          name: 1,
          type: 1,
          scope: 1,
          section: 1,
          archived: 1,
          created_at: 1,
          description: 1,
          member_count: {
            $size: {
              $filter: {
                input: "$workspace_members",
                as: "workspace_member",
                cond: {
                  $eq: ["$$workspace_member.removed", false]
                }
              }
            }
          },
          creator_name: {
            $concat: [
              "$creator_info.first_name",
              " ",
              "$creator_info.last_name"
            ]
          }
        }
      },
      {
        $project: {
          creator: 0,
          creator_info: 0
        }
      }
    ];

    const paginationResult = await Pagination(
      workspaceModel,
      page,
      limit,
      query
    );

    return {
      limit,
      search,
      result: paginationResult.result,
      next_page: paginationResult.next_page
    };
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Failed to return pagination of search of the workspace_members collection"
      );

    throw err;
  }
};
