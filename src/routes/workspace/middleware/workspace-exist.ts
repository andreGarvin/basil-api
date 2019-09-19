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
