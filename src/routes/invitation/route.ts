import * as url from "url";

import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// modules
import invitation from "./index";

// utils
import logger from "../../common/logger";

// middleware
// import authenticationMiddlewarePipeline from "../authentication/middleware/authentication";
import invitationPermissionMiddlware from "./middleware/invitation-premission";

// error codes
import { VALIDATION_EXCEPTION } from "../../common/error-codes";
import returnInt from "../../common/utils/return-int";

const middlewarePipeline = [
  // ...authenticationMiddlewarePipeline,
  invitationPermissionMiddlware
];

router.post("/send", middlewarePipeline, (req, res, next) => {
  const schema = joi.object().keys({
    type: joi
      .string()
      .regex(/student|professor|admin/)
      .optional()
      .error(
        () => "This field value does not match the default type of invitation"
      ),
    email: joi
      .string()
      .email()
      .required()
      .error(
        () => "You must provdie a valid email in order to send a invitation"
      ),
    resend: joi.boolean().optional()
  });

  const { error } = joi.validate(req.body, schema, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error_code: VALIDATION_EXCEPTION,
      message: "There seems to be issue with the invitation request",
      errors: error.details.map(err => {
        return { message: err.message, field: err.context.key };
      })
    });
  }

  return invitation
    .sendInvitation(req.state.user, req.body.email, req.body.type)
    .then(invitation => res.status(200).json(invitation))
    .catch(next);
});

router.get("/open/:invite_id", (req, res, next) => {
  try {
    // getting the invite id
    const inviteId = req.params.invite_id;

    // creating a url to recdirect to
    const redirectUrl = new url.URL(
      req.query.redirectUrl || process.env.WEB_APP_HOST
    );
    // changing the http protocol depending on the server environment
    redirectUrl.protocol = process.env.IS_DOCKER ? "https" : "http";
    // change the path of the url
    redirectUrl.pathname = "/signup";

    // checking if the host matches the host of the server
    const WEB_APP_HOST = url.parse(process.env.WEB_APP_HOST).hostname;
    if (redirectUrl.hostname !== WEB_APP_HOST) {
      redirectUrl.hostname = WEB_APP_HOST;
    }

    return invitation
      .getInvitation(inviteId)
      .then(invitation => {
        if (invitation === null) {
          return res.redirect(redirectUrl.href);
        }

        redirectUrl.searchParams.append("role", invitation.type);
        redirectUrl.searchParams.append("email", invitation.email);

        res.redirect(redirectUrl.href);
      })
      .catch(err => {
        if (err instanceof Error) {
          logger.error("Failed to redirect user", err);
        }

        res.redirect(redirectUrl.href);
      });
  } catch (err) {
    logger.error("Failed to redirect user to /sinup", err);

    return next(err);
  }
});

// this updates the emails being saved into the database
router.put("/update", middlewarePipeline, (req, res, next) => {
  const schema = joi.object().keys({
    id: joi
      .string()
      .required()
      .error(
        () => "This is not a valid id and is required to update the invitation"
      ),
    email: joi
      .string()
      .email()
      .optional()
      .error(() => "Must provide a valid email"),
    type: joi
      .string()
      .regex(/student|professor|admin/)
      .optional()
      .allow("")
      .error(() => "Must provide the a valid type of invitation")
  });

  const { error } = joi.validate(req.body, schema, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error_code: VALIDATION_EXCEPTION,
      message: "Something when wrong while trying to update the invitation",
      errors: error.details.map(err => {
        return { message: err.message, field: err.context.key };
      })
    });
  }

  return invitation
    .updateInvitationRole(req.state.user, req.body.id, req.body.role)
    .then(invitation => res.status(200).json(invitation))
    .catch(next);
});

router.delete("/delete/:id", middlewarePipeline, (req, res, next) => {
  return invitation
    .deleteInvite(req.state.user, req.params.id)
    .then(invitationId => {
      res.status(200).json({
        invitation_id: invitationId
      });
    })
    .catch(next);
});

router.post("/batch", middlewarePipeline, (req, res, next) => {
  const schema = joi.object().keys({
    type: joi
      .string()
      .required()
      .regex(/student|professor|admin/)
      .error(() => "Must provide the a valid type of invitation"),
    emails: joi
      .array()
      .items(
        joi
          .string()
          .email()
          .required()
          .error(() => "Must provide a valid email")
      )
      .max(30)
      .min(1)
      .error(([err]) => {
        if (err.type === "array.includesOne") {
          return err;
        }

        return "The amount of invitations that were sent is greater then the max amount or is less then what is needed";
      })
  });

  const { error } = joi.validate(req.body, schema, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error_code: VALIDATION_EXCEPTION,
      message:
        "There seems to be something wrong with the bulk invitation that was provided",
      errors: error.details.map(err => {
        return { message: err.message, field: err.context.key };
      })
    });
  }

  return invitation
    .sendBlukInvitation(req.user, req.body.emails, req.body.type)
    .then(invitations => res.status(200).json(invitations))
    .catch(next);
});

router.get("/batch", middlewarePipeline, (req, res, next) => {
  const body = {
    search: req.query.search,
    limit: req.query.limit,
    latest: req.query.lst,
    page: req.query.page,
    type: req.query.type
  };

  // converting the limit to a number
  body.limit = returnInt(body.limit, 10, 30);

  // if the limit less then or is greater then 20
  if (body.limit < 0 || body.limit > 30) {
    body.limit = 30;
  }

  body.page = returnInt(body.page, 10, 1);

  // converting body.latest into a boolean
  body.latest = Boolean(body.latest);

  const schema = joi.object().keys({
    type: joi
      .string()
      .regex(/student|professor|admin/)
      .optional()
      .allow(""),
    search: joi
      .string()
      .optional()
      .allow(""),
    latest: joi.string().optional(),
    limit: joi.string().optional(),
    page: joi.string().optional()
  });

  const { error } = joi.validate(body, schema, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error_code: VALIDATION_EXCEPTION,
      message: "Something went wrong with your query",
      errors: error.details.map(err => {
        return { message: err.message, field: err.context.key };
      })
    });
  }

  return invitation
    .fetchBatch(
      req.state.user,
      body.page,
      body.limit,
      body.search,
      body.latest,
      body.type
    )
    .then(batch => res.status(200).json(batch))
    .catch(next);
});

export default router;
