// models
import userModel from "../authentication/model";
import workspaceModel from "./model";

// module
import { InvitationRoles } from "../invitation";

// config
import { CHARACTER_LIMIT } from "../../config";

// utils
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";

// error codes
import AuthenticationError from "../authentication/error-codes";
import WorkspaceError from "./error-codes";

// types
import {
  WorkspaceInfo,
  NewWorkspaceInfo,
  UpdatedWorkspaceInfo,
  UpdateWorkspaceInfoParameters
} from "./types";

// the different workspace types
export enum WorkspaceTypes {
  class = "class",
  club = "club"
}

// the different workspace scopes
export enum WorkspaceScopes {
  private = "private",
  public = "public",
  global = "global"
}

/**
 * This function creates/inserts a new workspace into the workspaces collection
 *
 * @param userId The user id
 * @param newWorkspaceParamters The new information for creating the workspace
 */
export const createWorkspace = async (
  userId: string,
  newWorkspaceParamters: NewWorkspaceInfo
): Promise<WorkspaceInfo> => {
  try {
    // fetching the user information
    const user = await userModel.findOne(
      { id: userId },
      // only returning the the need information
      {
        id: 1,
        _id: 0,
        role: 1,
        school_id: 1
      }
    );
    if (user === null) {
      logger
        .child({ id: userId })
        .error(
          "Internal server error, failed to fetch user data from 'users' collection"
        );

      throw new Error(
        "Internal server error, failed to fetch user data from 'users' collection"
      );
    }

    // checking the user's role
    if (user.role === InvitationRoles.STUDENT) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_ROLE_PREMISSION_EXCEPTION,
        "you do not have premission to create workspaces",
        { http_code: 401 }
      );
    }

    // setting the default 'type' if the one was not provided
    if (!newWorkspaceParamters.type) {
      newWorkspaceParamters.type = WorkspaceTypes.class;
    }

    // setting the default 'scope' if the one was not provided
    if (!newWorkspaceParamters.scope) {
      newWorkspaceParamters.scope = WorkspaceScopes.private;
    }

    if (newWorkspaceParamters.type === WorkspaceTypes.class) {
      // setting the default 'section' if the one was not provided
      if (!newWorkspaceParamters.section) {
        throw ErrorResponse(
          WorkspaceError.WORKSPACE_SECTION_EXECPTION,
          "You must provide a section for the class",
          { http_code: 400 }
        );
      }
    } else if (newWorkspaceParamters.type === WorkspaceTypes.club) {
      // if the workspace is a club then just set it to null
      newWorkspaceParamters.section = null;
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
      section: newWorkspaceParamters.section || null,
      description: newWorkspaceParamters.description || ""
    });

    // inserting the new workspace info into the 'workspaces' collection
    await newWorkspace.save();

    return {
      id: newWorkspace.id,
      name: newWorkspace.name,
      type: newWorkspace.type,
      scope: newWorkspace.scope,
      section: newWorkspace.section,
      creator: newWorkspace.creator,
      archived: newWorkspace.archived,
      created_at: newWorkspace.created_at,
      description: newWorkspace.description,
      meta: {
        is_creator: true
      }
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
    // fetching the user information, only getting the user id
    const user = await userModel.findOne({ id: userId }, { _id: 0, id: 1 });
    if (user === null) {
      logger
        .child({ id: userId })
        .error(
          "Internal server error, failed to fetch user data from 'users' collection"
        );

      throw new Error(
        "Internal server error, failed to fetch user data from 'users' collection"
      );
    }

    const workspace = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      { _id: 0, id: 1, archived: 1 }
    );
    if (workspace === null) {
      // if the user is not a admin or the creator of the workspace
      if (
        user.role !== InvitationRoles.ADMIN ||
        workspace.creator !== user.id
      ) {
        throw ErrorResponse(
          WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION,
          "this workspace does not exist",
          { http_code: 404 }
        );
      }
    }

    const archive: boolean = !workspace.archived;

    // updating the workspace archive status
    const status = await workspaceModel.updateOne(
      {
        id: workspace.id
      },
      {
        $set: {
          archived: archive
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign(status, {
        id: workspace.id
      });

      logger.child(fields).debug("inspecting information");

      throw new Error("Failed to update the workspace to be archived");
    }

    return archive;
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
    // fetching the user information, only getting the user id
    const user = await userModel.findOne({ id: userId }, { _id: 0, id: 1 });
    if (user === null) {
      logger
        .child({ id: userId })
        .error(
          "Internal server error, failed to fetch user data from 'users' collection"
        );

      throw new Error(
        "Internal server error, failed to fetch user data from 'users' collection"
      );
    }

    // getting the workspace information
    const workspace = await workspaceModel.findOne(
      {
        id: workspaceId,
        creator: user.id
      },
      {
        id: 1,
        _id: 0,
        name: 1,
        type: 1,
        scope: 1,
        section: 1,
        archived: 1,
        school_id: 1,
        description: 1
      }
    );
    if (workspace === null) {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION,
        "this workspace does not exist",
        { http_code: 404 }
      );
    }

    if (workspace.archived) {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION,
        "this workspace has been archived",
        { http_code: 403 }
      );
    }

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
      creator: user.id
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
        creator: user.id
      },
      { $set: workspaceInfo }
    );

    if (status.n === 0) {
      const fields = Object.assign(status, workspaceInfo, {
        id: workspaceId,
        creator: user.id
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
