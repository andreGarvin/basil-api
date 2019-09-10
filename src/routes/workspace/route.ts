import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// config
import { ValidationJsonResponse } from "../../config";

// module
import * as workspace from "./index";

// utils
import joiValidateResponse from "../../common/utils/joi-validate-response";
import returnInt from "../../common/utils/return-int";

// route
import workspaceMemberRoute from "./member/route";

// middleware
import authenticationMiddleware from "../authentication/middleware/authentication";

// request schemas
import {
  updateWorkspaceInfoSchema,
  createWorkspaceSchema,
  workspaceSearchParams
} from "./request-schemas";

router.use(authenticationMiddleware);

router.use("/member", workspaceMemberRoute);

router.get("/search", (req, res, next) => {
  const body = {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search || ""
  };

  body.page = returnInt(body.page, 10, 1);

  body.limit = returnInt(body.limit, 10, 15);
  if (body.limit > 15 || body.limit <= 0) {
    body.limit = 15;
  }

  const { error } = joi.validate(body, workspaceSearchParams);
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  if (!body.search) {
    return res.status(200).json({
      results: [],
      next_page: -1,
      page: body.page,
      limit: body.limit,
      search: body.search
    });
  }

  return workspace
    .searchForWorkspaces(req.state.user, body.search, body.page, body.limit)
    .then(result => res.status(200).json(result))
    .catch(next);
});

router.get("/", (req, res, next) => {
  return workspace
    .getUserWorkspaces(req.state.user)
    .then(workspaces => res.status(200).json({ workspaces }))
    .catch(next);
});

router.get("/:workspace_id", (req, res, next) => {
  return workspace
    .getWorkspace(req.state.user, req.params.workspace_id)
    .then(workspaceInfo => res.status(200).json(workspaceInfo))
    .catch(next);
});

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

router.patch("/info/:workspace_id", (req, res, next) => {
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
