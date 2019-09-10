import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// modules
import * as invitation from "../invitation/index";
import * as registry from "./index";

// utils
import joiValidationResponse from "../../common/utils/joi-validate-response";
import returnInt from "../../common/utils/return-int";

// middleware
import apiAuthenticationMiddleware from "../middleware/api-authentication";

// request schema for resgitry endpoints
import {
  registrySearchParams,
  newSchoolInfoSchema,
  addAdminbulkSchema
} from "./request-schemas";

// error codes
import { ValidationJsonResponse } from "../../config";

router.post("/register", apiAuthenticationMiddleware, (req, res, next) => {
  const { error } = joi.validate(req.body, newSchoolInfoSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidationResponse(error.details) })
      );
  }

  const { name, domain = "" } = req.body;
  return registry
    .insert(name, domain)
    .then(school_id => res.status(200).json({ school_id }))
    .catch(next);
});

router.post(
  "/invite/admin/bulk",
  apiAuthenticationMiddleware,
  (req, res, next) => {
    const { error } = joi.validate(req.body, addAdminbulkSchema, {
      abortEarly: false
    });
    if (error) {
      return res.status(400).json(
        ValidationJsonResponse({
          errors: joiValidationResponse(error.details)
        })
      );
    }

    return invitation
      .sendbulkAdminInvitations(req.body.emails, req.body.school_id)
      .then(() => res.status(200).json({ sent: true }))
      .catch(next);
  }
);

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

  const { error } = joi.validate(body, registrySearchParams);
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidationResponse(error.details) })
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

  return registry
    .searchRegistry(body.search, body.page, body.limit)
    .then(response => res.status(200).json(response))
    .catch(next);
});

export default router;
