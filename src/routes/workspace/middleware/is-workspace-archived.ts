import * as express from "express";

// model
import workspaceModel from "../model";

// error code
import WorkspaceError from "../error-codes";

export default () => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const workspaceId = req.params.workspace_id || req.body.workspace_id;

    return workspaceModel
      .findOne(
        {
          id: workspaceId
        },
        {
          archived: 1
        }
      )
      .then(workspaceInfo => {
        // checking if the class has been archived
        if (workspaceInfo.archived) {
          throw res.status(403).json({
            error_code: WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION,
            message: "this workspace has been archived"
          });
        }

        return next();
      })
      .catch(next);
  };
};
