import * as express from "express";
const router = express();

import * as joi from "joi";

// module
import * as messenger from "./index";

// config
import { ValidationJsonResponse } from "../../config";

// utils
import joiValidateResponse from "../../common/utils/joi-validate-response";

// middleware
import isWorkspaceMemberMiddleware from "../workspace/member/middleware/workspace-member";
import authenticationMiddleware from "../authentication/middleware/authentication";
import workspaceExistMiddleware from "../workspace/middleware/workspace-exist";

// reqyest schemas
import {
  newDirectMessageSchema,
  groupSearchParams,
  newChannelSchema,
  newGroupSchema
} from "./request-schemas";
import returnInt from "../../common/utils/return-int";

router.use(authenticationMiddleware);

// direct message
router.post(
  "/direct-message/create/:workspace_id",
  workspaceExistMiddleware(true),
  isWorkspaceMemberMiddleware(),
  (req, res, next) => {
    const { error } = joi.validate(req.body, newDirectMessageSchema, {
      abortEarly: false
    });
    if (error) {
      return res.status(400).json(
        ValidationJsonResponse({
          errors: joiValidateResponse(error.details)
        })
      );
    }

    return messenger
      .createDirectMessage(
        req.state.user,
        req.params.workspace_id,
        req.body.member
      )
      .then(newDirectMessage => res.status(201).json(newDirectMessage))
      .catch(next);
  }
);

// channel
router.post(
  "/channel/create/:workspace_id",
  workspaceExistMiddleware(true),
  isWorkspaceMemberMiddleware(true),
  (req, res, next) => {
    const { error } = joi.validate(req.body, newChannelSchema, {
      abortEarly: false
    });
    if (error) {
      return res.status(400).json(
        ValidationJsonResponse({
          errors: joiValidateResponse(error.details)
        })
      );
    }

    return messenger
      .createChannel(
        req.state.user,
        req.params.workspace_id,
        req.body.name,
        req.body.description
      )
      .then(newChannel => res.status(201).json(newChannel))
      .catch(next);
  }
);

// group
router.post(
  "/group/create/:workspace_id",
  workspaceExistMiddleware(true),
  isWorkspaceMemberMiddleware(),
  (req, res, next) => {
    const { error } = joi.validate(req.body, newGroupSchema, {
      abortEarly: false
    });
    if (error) {
      return res.status(400).json(
        ValidationJsonResponse({
          errors: joiValidateResponse(error.details)
        })
      );
    }

    return messenger
      .createGroup(
        req.state.user,
        req.params.workspace_id,
        req.body.name,
        req.body.is_private,
        req.body.description
      )
      .then(newGroup => res.status(201).json(newGroup))
      .catch(next);
  }
);

router.get(
  "/search/:workspace_id",
  workspaceExistMiddleware(true),
  isWorkspaceMemberMiddleware(),
  (req, res, next) => {
    const body = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || ""
    };

    body.page = returnInt(body.page, 10, 1);
    body.limit = returnInt(body.limit, 10, 20);

    const { error } = joi.validate(body, groupSearchParams, {
      abortEarly: false
    });
    if (error) {
      return res.status(400).json(
        ValidationJsonResponse({
          errors: joiValidateResponse(error.details)
        })
      );
    }

    return messenger
      .searchForGroups(
        req.state.user,
        req.params.workspace_id,
        body.search,
        body.page,
        body.limit
      )
      .then(response => res.status(200).json(response))
      .catch(next);
  }
);

router.get(
  "/feeling-lucky/:workspace_id",
  workspaceExistMiddleware(true),
  isWorkspaceMemberMiddleware(),
  (req, res, next) => {
    const isChannel = req.query.is_channel === "true";

    return messenger
      .feelingLucky(req.params.workspace_id, isChannel)
      .then(newGroupName => res.status(200).json({ name: newGroupName }))
      .catch(next);
  }
);

export default router;
