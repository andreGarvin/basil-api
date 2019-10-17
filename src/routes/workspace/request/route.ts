import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// module
import * as memberRequest from "./index";

// config
import { ValidationJsonResponse } from "../../../config";

// utils
import joiValidateResponse from "../../../common/utils/joi-validate-response";
import returnInt from "../../../common/utils/return-int";

// middleware
import isWorkspaceMemberMiddleware from "../member/middleware/is-workspace-member";
import isWorkspaceArchivedMiddleware from "../middleware/is-workspace-archived";

// schemas
export const searchParamsSchema = joi.object().keys({
  page: joi.number().optional(),

  limit: joi.number().optional(),

  search: joi
    .string()
    .allow("")
    .optional()
});

router.post("/send/:workspace_id", (req, res, next) => {
  return memberRequest
    .saveMemberRequest(req.state.user, req.params.workspace_id)
    .then(requestResponse => res.status(200).json(requestResponse))
    .catch(next);
});

router.post(
  "/accept/:workspace_id/:user_id",
  isWorkspaceMemberMiddleware(true),
  isWorkspaceArchivedMiddleware(),
  (req, res, next) => {
    return memberRequest
      .acceptMemberRequest(
        req.state.user,
        req.params.workspace_id,
        req.params.user_id
      )
      .then(requestResponse => res.status(200).json(requestResponse))
      .catch(next);
  }
);

router.delete("/delete/:workspace_id", (req, res, next) => {
  return memberRequest
    .deleteMemberRequest(req.state.user, req.params.workspace_id)
    .then(() => res.status(200).json({ deleted: true }))
    .catch(next);
});

router.delete(
  "/reject/:workspace_id/:user_id",
  isWorkspaceMemberMiddleware(true),
  isWorkspaceArchivedMiddleware(),
  (req, res, next) => {
    return memberRequest
      .rejectMemberRequest(req.params.workspace_id, req.params.user_id)
      .then(() => res.status(200).json({ rejected: true }))
      .catch(next);
  }
);

router.get(
  "/:workspace_id",
  isWorkspaceMemberMiddleware(true),
  (req, res, next) => {
    const body = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || ""
    };

    body.page = returnInt(body.page, 10, 1);
    body.limit = returnInt(body.limit, 10, 15);

    const { error } = joi.validate(body, searchParamsSchema);
    if (error) {
      return res
        .status(400)
        .json(
          ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
        );
    }

    return memberRequest
      .getMemberRequests(
        req.params.workspace_id,
        body.search,
        body.page,
        body.limit
      )
      .then(result => res.status(200).json(result))
      .catch(next);
  }
);

export default router;
