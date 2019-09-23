import * as express from "express";

// model
import workspaceModel from "../model";

// util
import ErrorResponse from "../../../common/utils/error";

// error code
import WorkspaceError from "../error-codes";

const getWorkspace = async (
  workspaceId: string
): Promise<{ archived: boolean }> => {
  const workspaceInfo = await workspaceModel.findOne(
    {
      id: workspaceId
    },
    {
      archived: 1
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

  return workspaceInfo;
};

/**
 * This middleware checks if the workspace exist, but also checks
 * if the workspace has been archived as well
 *
 * #TODO: This function needs to be refactored at a later point,
 * particularly when checking if the workspace has been archived.
 * For a user that is not a member of the private workspace that
 * has been archived will know if its existence
 *
 * @param isArchived Check if the workspace is archived
 */
export default (isArchived?: boolean) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const workspaceId = req.params.workspace_id || req.body.workspace_id;

    return getWorkspace(workspaceId)
      .then(workspaceInfo => {
        if (isArchived && workspaceInfo.archived) {
          return res.status(403).json({
            error_code: WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION,
            message: "this workspace has been archived"
          });
        }

        return next();
      })
      .catch(next);
  };
};
