import * as url from "url";

import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// module
import * as invitation from "./index";

// utils
import validationResponse from "../../common/utils/joi-validate-response";
import logger from "../../common/logger";

// config
import { ValidationJsonResponse, WEB_APP_HOST } from "../../config";

// middleware
import authenticationMiddlewarePipeline from "../authentication/middleware/authentication";
import invitationPermissionMiddlware from "./middleware/invitation-premission";

// invitation request body schema
import {
  recipientInvitationInfoSchema,
  bulkInvitationSchema
} from "./request-schemas";

const middlewarePipeline = [
  ...authenticationMiddlewarePipeline,
  invitationPermissionMiddlware
];

router.delete("/delete/:email", middlewarePipeline, (req, res, next) => {
  return invitation
    .deleteInvitation(req.state.user, req.params.email)
    .then(invitationId => {
      res.status(200).json({ invitation_id: invitationId });
    })
    .catch(next);
});

router.put("/update", middlewarePipeline, (req, res, next) => {
  const { error } = joi.validate(req.body, recipientInvitationInfoSchema, {
    abortEarly: false
  });
  if (error) {
    ValidationJsonResponse.context.errors = validationResponse(error.details);

    return res.status(400).json(ValidationJsonResponse);
  }

  const { email, type } = req.body;
  return invitation
    .updateInvitation(req.state.user, email, type)
    .then(updatedInvitationInformation => {
      res.status(200).json(updatedInvitationInformation);
    })
    .catch(next);
});

router.post("/send/bulk", middlewarePipeline, (req, res, next) => {
  const { error } = joi.validate(req.body, bulkInvitationSchema, {
    abortEarly: false
  });
  if (error) {
    ValidationJsonResponse.context.errors = validationResponse(error.details);

    return res.status(400).json(ValidationJsonResponse);
  }

  return invitation
    .sendbulkInvitation(req.state.user, req.body.emails, req.body.type)
    .then(bulkStatus => {
      const cleanbulkStatus = bulkStatus.map(invitation => {
        delete invitation.id;

        return invitation;
      });

      res.status(200).json({ response: cleanbulkStatus });
    })
    .catch(next);
});

router.post("/send", middlewarePipeline, (req, res, next) => {
  const { error } = joi.validate(req.body, recipientInvitationInfoSchema, {
    abortEarly: false
  });
  if (error) {
    ValidationJsonResponse.context.errors = validationResponse(error.details);

    return res.status(400).json(ValidationJsonResponse);
  }

  return invitation
    .sendInvitation(req.state.user, req.body.email, req.body.type)
    .then(invitation => res.status(200).json(invitation))
    .catch(next);
});

router.get("/open/:invite_id", (req, res, next) => {
  try {
    // getting the invite id
    const invitationId = req.params.invite_id;

    // creating a url to recdirect to the frontend web page signup page
    const redirectUrl = new url.URL(WEB_APP_HOST);
    // changing the http protocol depending on the server environment
    redirectUrl.protocol = process.env.IS_DOCKER ? "https" : "http";
    // change the path of the url
    redirectUrl.pathname = "/signup";

    return invitation
      .getInvitationInfo(invitationId)
      .then(invitation => {
        redirectUrl.searchParams.append("role", invitation.type);
        redirectUrl.searchParams.append("email", invitation.email);
        redirectUrl.searchParams.append("school_id", invitation.school_id);

        res.redirect(redirectUrl.href);
      })
      .catch(err => {
        if (err instanceof Error) {
          logger
            .child({ error: err })
            .error(
              "Failed to redirect user to /signup on retriveing invitation info"
            );
        }

        res.redirect(redirectUrl.href);
      });
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to redirect user to /signup");
    }

    console.log(err);

    return next(err);
  }
});

export default router;
