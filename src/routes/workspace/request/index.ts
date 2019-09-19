import { URL } from "url";

// models
import workspaceMemberModel from "../member/model";
import userModel from "../../authentication/model";
import workspaceMemberRequestModel from "./model";
import workspaceModel from "../model";

// config
import { NO_REPLY, WEB_APP_HOST } from "../../../config";

// utils
import Pagination from "../../../common/utils/pagination";
import ErrorResponse from "../../../common/utils/error";
import logger from "../../../common/logger";
import {
  sendEmailTemplate,
  TEMPLATES
} from "../../../common/utils/send-email-template";

// error codes
import WorkspaceMemberError from "../member/error-codes";
import WorkspaceMemberRequestError from "./error-codes";
import WorkspaceError from "../error-codes";
import { WorkspaceScopes } from "..";

// types
import { PaginationResults } from "../../../types";
import {
  SavedWorkspaceMemberRequest,
  WorkspaceMemberRequestInfo
} from "./types";

/**
 * This function sends a email notification to the user's email inbox
 * when the reuqtes the user sent has ben accpeted by a admin of the
 * workspace
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param memberUserId the user of the new workspace member
 */
const sendRequestAcceptanceEmailNotification = async (
  userId: string,
  workspaceId: string,
  memberUserId: string
): Promise<void> => {
  try {
    const workspaceInfo = await workspaceModel.findOne({
      id: workspaceId
    });
    const workspaceAdminUserInfo = await userModel.findOne({
      id: userId
    });
    const workspaceMemberUserInfo = await userModel.findOne({
      id: memberUserId
    });

    // constructing the url for the workspace
    const workspaceLink = new URL(WEB_APP_HOST);
    workspaceLink.protocol = process.env.IS_DOCKER ? "https" : "http";
    // #TODO: Later add the main general channel id for the workspace
    workspaceLink.pathname = `/messenger/${workspaceId}`;

    await sendEmailTemplate(
      TEMPLATES.ACCEPTED_WORKSPACE_MEMBER_REQUEST,
      {
        from: NO_REPLY,
        to: workspaceMemberUserInfo.email,
        subject: "Workspace member request accepted"
      },
      {
        // workspace information
        workspace: {
          type: workspaceInfo.type,
          link: workspaceLink.href,
          name:
            `${workspaceInfo.name}` +
            (workspaceInfo.section ? ` section ${workspaceInfo.section}` : "")
        },
        // the workspace admin information
        admin: {
          email: workspaceAdminUserInfo.email,
          name: `${workspaceAdminUserInfo.first_name} ${workspaceAdminUserInfo.last_name}`
        },
        // the new workspace information member
        member: {
          email: workspaceMemberUserInfo.email,
          name: `${workspaceMemberUserInfo.first_name} ${workspaceMemberUserInfo.last_name}`
        }
      }
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Failed to send a email notification for workspace member request acceptance"
      );

    throw err;
  }
};

/**
 * This function inserts a docuemnt of a user making a request to join the a public workspace.
 * This will not allow users request to join a private workspace
 *
 * @param userId The id if the user
 * @param workspaceId The id of the workspace
 */
export const saveMemberRequest = async (
  userId: string,
  workspaceId: string
): Promise<SavedWorkspaceMemberRequest> => {
  try {
    // fetching workspace information
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        name: 1,
        type: 1,
        scope: 1,
        section: 1
      }
    );
    if (workspaceInfo.scope === WorkspaceScopes.private) {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION,
        "this workspace does not exits",
        { http_code: 404 }
      );
    }

    // fetching workspace information
    const workspaceMember = await workspaceMemberModel.findOne({
      user_id: userId,
      workspace_id: workspaceId
    });
    if (workspaceMember) {
      if (!workspaceMember.removed) {
        throw ErrorResponse(
          WorkspaceMemberError.WORKSPACE_MEMBER_EXIST_EXCEPTION,
          "you are already a member of the workspace",
          { http_code: 400 }
        );
      }
    }

    // checking if the request to join the workspace exist
    const workspaceMemberRequest = await workspaceMemberRequestModel.findOne({
      user_id: userId,
      workspace_id: workspaceId
    });
    if (workspaceMemberRequest) {
      throw ErrorResponse(
        WorkspaceMemberRequestError.WORKSPACE_MEMBER_REQUEST_EXIST_EXECPTION,
        "this workspace member request already exist",
        { http_code: 400 }
      );
    }

    // creating a new request
    const newWorkspaceMemberRequest = new workspaceMemberRequestModel({
      user_id: userId,
      workspace_id: workspaceId
    });

    // inserting the new request
    await newWorkspaceMemberRequest.save();

    return {
      name: workspaceInfo.name,
      type: workspaceInfo.type,
      workspace_id: workspaceId,
      section: workspaceInfo.section,
      sent_at: newWorkspaceMemberRequest.sent_at
    };
  } catch (err) {
    if (err instanceof Error) {
      // if a mongodb duplicate error is thrown
      if (err.stack.includes("duplicate key")) {
        throw ErrorResponse(
          WorkspaceMemberRequestError.WORKSPACE_MEMBER_REQUEST_EXIST_EXECPTION,
          "this workspace member request already exist",
          { http_code: 400 }
        );
      }

      logger
        .child({ error: err })
        .error("Failed to save request to workspace_member_request collection");
    }

    throw err;
  }
};

/**
 * This function retrieves all the requets that were sent bby other users that want to
 * join the workspce
 *
 * @param workspaceId The id of the workspace
 * @param search The plain text search
 * @param page The page number in the pagination
 * @param limit The desired number of documents to return in each pagination
 */
export const getMemberRequests = async (
  workspaceId: string,
  search?: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<WorkspaceMemberRequestInfo>> => {
  try {
    const query = [
      {
        $match: {
          workspace_id: workspaceId
        }
      },
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "user_id"
        }
      },
      {
        $unwind: "$users"
      },
      {
        $project: {
          user_id: "$user_id",
          photo_url: "$users.photo_url",
          name: {
            $concat: ["$users.first_name", " ", "$users.last_name"]
          }
        }
      },
      {
        $match: {
          name: {
            $options: "i",
            $regex: search
          }
        }
      }
    ];

    const PaginationResults = await Pagination(
      workspaceMemberRequestModel,
      page,
      limit,
      query
    );

    return {
      limit,
      search,
      result: PaginationResults.result,
      next_page: PaginationResults.next_page
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to ");
    }

    throw err;
  }
};

/**
 * This function deletes a request a user had sent to the workspace
 *
 * @param userId The id of the user
 * @param workspaceId The id of the workspace
 */
export const deleteMemberRequest = async (
  userId: string,
  workspaceId: string
): Promise<void> => {
  try {
    const status = await workspaceMemberRequestModel.deleteOne({
      user_id: userId,
      workspace_id: workspaceId
    });

    if (status.n === 0) {
      logger.warn("workspace member request was not deleted");
    }
  } catch (err) {
    logger
      .child({ error: err })
      .error("Failed to delete workspace member request from collection");

    throw err;
  }
};

/**
 * This function deletes a reuqest that was sent by a user who wants to join the workspace
 *
 * @param requestUserId The id of thr user who sent the request
 * @param workspaceId The id of the workspace
 */
export const rejectMemberRequest = async (
  workspaceId: string,
  requestUserId: string
): Promise<void> => {
  try {
    const status = await workspaceMemberRequestModel.deleteOne({
      user_id: requestUserId,
      workspace_id: workspaceId
    });

    if (status.n === 0) {
      logger.warn("workspace member request was not deleted");
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to ");
    }

    throw err;
  }
};

/**
 * This function accepts a request that was sent by a user to join the workspace
 *
 * @param userId The user id of the admin who is accepting the request
 * @param workspaceId The id of the workspace
 * @param requestUserId The id of the user who sent the request
 */
export const acceptMemberRequest = async (
  userId: string,
  workspaceId: string,
  requestUserId: string
): Promise<void> => {
  try {
    //checking if the request exist
    const memberRequest = await workspaceMemberRequestModel.findOne({
      user_id: requestUserId,
      workspace_id: workspaceId
    });
    if (memberRequest === null) {
      throw ErrorResponse(
        WorkspaceMemberRequestError.WORKSPACE_MEMBER_REQUEST_NOT_FOUND_EXCEPTION,
        "this workspace request does not exist",
        { http_code: 404 }
      );
    }

    // deleting the request document
    const status = await workspaceMemberRequestModel.deleteOne({
      user_id: requestUserId,
      workspace_id: workspaceId
    });

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        user_id: requestUserId,
        workspace_id: workspaceId
      });

      logger
        .child(fields)
        .error(
          "Internal server error, failed to delete user workspace request from the workspace_member_requests collection"
        );

      throw new Error(
        "Internal server error, failed to delete user workspace request from the workspace_member_requests collection"
      );
    }

    // creating a new workspace member document
    const newWorkspaceMember = new workspaceMemberModel({
      user_id: requestUserId,
      workspace_id: workspaceId
    });

    // inserting a new workspace member document
    await newWorkspaceMember.save();

    // sendint he user a email notification
    await sendRequestAcceptanceEmailNotification(
      userId,
      workspaceId,
      requestUserId
    );
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to accept the user request and sending a email notification"
        );
    }

    throw err;
  }
};
