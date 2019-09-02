import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// config
import { ValidationJsonResponse, WEB_APP_HOST } from "../../config";

// module
import * as workspace from "./index";

// utils
import joiValidateResponse from "../../common/utils/joi-validate-response";

// middleware
import authenticationMiddleware from "../authentication/middleware/authentication";

// request schemas
import {
  createWorkspaceSchema,
  updateWorkspaceInfoSchema
} from "./request-schemas";

router.use(authenticationMiddleware);

router.post("/create", (req, res, next) => {
  const { error } = joi.validate(req.body, createWorkspaceSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return workspace
    .createWorkspace(req.state.user, req.body)
    .then(newWorkspaceInfo => res.status(201).json(newWorkspaceInfo))
    .catch(next);
});

router.patch("/update/:workspace_id", (req, res, next) => {
  const workspaceId: string = req.params.workspace_id;

  const { error } = joi.validate(req.body, updateWorkspaceInfoSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return workspace
    .updateWorkspaceInfo(req.state.user, workspaceId, req.body)
    .then(updatedWorkspaceInfo => res.status(200).json(updatedWorkspaceInfo))
    .catch(next);
});

router.put("/archive/:workspace_id", (req, res, next) => {
  const workspaceId: string = req.params.workspace_id;

  return workspace
    .archiveWorkspace(req.state.user, workspaceId)
    .then(archived => res.status(200).json({ archived }))
    .catch(next);
});

export default router;
