import * as express from "express";

import workspaceMemberModel from "../model";
import workspaceModel from "../../model";

import { WorkspaceScopes } from "../..";

import ErrorResponse from "../../../../common/utils/error";

import WorkspaceMemberError from "../error-codes";
import WorkspaceError from "../../error-codes";

const getWorkspaceMemberInfo = async (
  userId: string,
  workspaceId: string
): Promise<{ is_admin: boolean; is_creator: boolean }> => {
  const workspaceInfo = await workspaceModel.findOne(
    {
      id: workspaceId
    },
    {
      scope: 1,
      creator: 1
    }
  );
  if (workspaceInfo === null) {
    throw ErrorResponse(
      WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION,
      "this workspace does not exist",
      {
        http_code: 404
      }
    );
  }

  const workspaceMemberInfo = await workspaceMemberModel.findOne(
    {
      user_id: userId,
      workspace_id: workspaceId
    },
    {
      removed: 1,
      is_admin: 1
    }
  );
  if (workspaceMemberInfo === null || workspaceMemberInfo.removed) {
    if (workspaceInfo.scope === WorkspaceScopes.public) {
      throw ErrorResponse(
        WorkspaceMemberError.NOT_WORKSPACE_MEMBER_EXCEPTION,
        "you are not a member of this workspace",
        { http_code: 400 }
      );
    } else {
      throw ErrorResponse(
        WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION,
        "this workspace does not exist",
        { http_code: 404 }
      );
    }
  }

  return {
    is_admin: workspaceMemberInfo.is_admin,
    is_creator: userId === workspaceInfo.creator
  };
};

export default (isAdmin?: boolean, isCreator?: boolean) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const workspaceId: string =
      req.params.workspace_id || req.body.workspace_id;

    return getWorkspaceMemberInfo(req.state.user, workspaceId)
      .then(workspaceMemberInfo => {
        if (isAdmin && !workspaceMemberInfo.is_admin) {
          return res.status(401).json({
            error_code:
              WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION,
            message:
              "you are not a admin therefor you con not preform this action"
          });
        }

        if (isCreator && !workspaceMemberInfo.is_creator) {
          return res.status(401).json({
            message: "you are not the creator of this workspace",
            error_code: WorkspaceMemberError.NOT_WORKSPACE_CREATOR_EXCEPTION
          });
        }

        return next();
      })
      .catch(next);
  };
};
