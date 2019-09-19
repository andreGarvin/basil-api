import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// config
import { ValidationJsonResponse } from "../../../config";

// module
import * as workspaceMember from "./index";

// utils
import joiValidateResponse from "../../../common/utils/joi-validate-response";
import returnInt from "../../../common/utils/return-int";

// middleware
import roasterCsvParser from "./middleware/csv-workspace-member-parser";
import isWorkspaceMember from "./middleware/workspace-member";
import workspaceExist from "../middleware/workspace-exist";
import multerUploadMiddlware from "./middleware/multer";

// request schemas
import {
  workspaceMemberSearchParams,
  updateMemberStatusSchema,
  addMemberBulkSchema
} from "./request-schemas";

// error codes
import { FileError } from "../../../common/error-codes";

// csv upload middleware pipeline
const csvUploadPipelineMiddleware = (req, res, next) => {
  multerUploadMiddlware(req, res, err => {
    if (err) {
      switch (err.code || err.message) {
        case "LIMIT_UNEXPECTED_FILE":
          return res.status(400).json({
            error_code: FileError.INVALID_FIELD_NAME_EXCEPTION,
            message: "field name for the attached file is inccorect"
          });
        case FileError.INVALID_FILE_EXCEPTION:
          return res.status(400).json({
            message: "expected a csv file",
            error_code: FileError.INVALID_FILE_EXCEPTION
          });
        case FileError.EMPTY_FILE_EXCEPTION:
          return res.status(400).json({
            message: "can not provide empty files",
            error_code: FileError.EMPTY_FILE_EXCEPTION
          });
        default:
          return next(err);
      }
    }

    return roasterCsvParser(req, res, next);
  });
};

router.post(
  "/bulk/:workspace_id",
  workspaceExist(true),
  isWorkspaceMember(true),
  csvUploadPipelineMiddleware,
  (req, res, next) => {
    const { error } = joi.validate(req.body, addMemberBulkSchema, {
      abortEarly: false
    });
    if (error) {
      return res
        .status(400)
        .json(
          ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
        );
    }

    return workspaceMember
      .addMemberBulk(req.state.user, req.params.workspace_id, req.body.members)
      .then(response => res.status(200).json({ response }))
      .catch(next);
  }
);

router.get(
  "/invited/members/:workspace_id",
  workspaceExist(true),
  isWorkspaceMember(true),
  (req, res, next) => {
    const body = {
      page: req.query.page,
      limit: req.query.limit
    };

    body.page = returnInt(body.page, 10, 1);
    body.limit = returnInt(body.limit, 10, 20);

    const { error } = joi.validate(body, workspaceMemberSearchParams);
    if (error) {
      return res
        .status(400)
        .json(
          ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
        );
    }

    return workspaceMember
      .getInvitedWorkspaceMembers(
        req.params.workspace_id,
        body.page,
        body.limit
      )
      .then(response => res.status(200).json(response))
      .catch(next);
  }
);

router.get(
  "/members/:workspace_id",
  workspaceExist(true),
  isWorkspaceMember(),
  (req, res, next) => {
    const body = {
      page: req.query.page,
      limit: req.query.limit
    };

    body.page = returnInt(body.page, 10, 1);
    body.limit = returnInt(body.limit, 10, 20);

    const { error } = joi.validate(body, workspaceMemberSearchParams);
    if (error) {
      return res
        .status(400)
        .json(
          ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
        );
    }

    return workspaceMember
      .getMembers(req.params.workspace_id, body.page, body.limit)
      .then(response => res.status(200).json(response))
      .catch(next);
  }
);

router.get(
  "/search/:workspace_id",
  workspaceExist(true),
  isWorkspaceMember(),
  (req, res, next) => {
    const body = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || ""
    };

    body.page = returnInt(body.page, 10, 1);
    body.limit = returnInt(body.limit, 10, 20);

    const { error } = joi.validate(body, workspaceMemberSearchParams);
    if (error) {
      return res
        .status(400)
        .json(
          ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
        );
    }

    return workspaceMember
      .searchForMembers(
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
  "/info/:workspace_id/:member_user_id",
  workspaceExist(true),
  isWorkspaceMember(),
  (req, res, next) => {
    return workspaceMember
      .getMemberInfo(
        req.state.user,
        req.params.workspace_id,
        req.params.member_user_id
      )
      .then(memberInfo => res.status(200).json(memberInfo))
      .catch(next);
  }
);

router.put(
  "/admin/:workspace_id/:member_user_id",
  workspaceExist(true),
  isWorkspaceMember(true),
  (req, res, next) => {
    return workspaceMember
      .updateMemberAdminStatus(
        req.state.user,
        req.params.workspace_id,
        req.params.member_user_id
      )
      .then(isAdmin => res.status(200).json({ is_admin: isAdmin }))
      .catch(next);
  }
);

router.patch(
  "/info/:workspace_id",
  workspaceExist(true),
  isWorkspaceMember(),
  (req, res, next) => {
    const { error } = joi.validate(req.body, updateMemberStatusSchema, {
      abortEarly: false
    });
    if (error) {
      return res
        .status(400)
        .json(
          ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
        );
    }

    return workspaceMember
      .updateMemberStatus(
        req.state.user,
        req.params.workspace_id,
        req.body.status
      )
      .then(memberStatus =>
        res.status(200).json({ member_status: memberStatus })
      )
      .catch(next);
  }
);

router.delete(
  "/remove/:workspace_id/:member_user_id",
  workspaceExist(true),
  isWorkspaceMember(true),
  (req, res, next) => {
    return workspaceMember
      .removeMember(
        req.state.user,
        req.params.workspace_id,
        req.params.member_user_id
      )
      .then(isAdmin => res.status(200).json({ is_admin: isAdmin }))
      .catch(next);
  }
);

export default router;
