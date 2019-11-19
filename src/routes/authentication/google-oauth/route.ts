import * as express from "express";

const router = express.Router();

import * as joi from "joi";

// module
import * as googleOauth from "./index";

// utils
import {
  joiValidateResponse,
  ValidationJsonResponse
} from "../../../common/utils/validation-response";

// request schemas
import { createAccountWithGoogleSchema } from "../request-schemas";

router.get("/login", (req, res) => {
  const googleOauthUrl = googleOauth.createOauthUrl(
    googleOauth.OauthStateAction.LOGIN
  );

  res.redirect(googleOauthUrl);
});

router.get("/signup", (req, res) => {
  const googleOauthUrl = googleOauth.createOauthUrl(
    googleOauth.OauthStateAction.CREATE_ACCOUNT
  );

  res.redirect(googleOauthUrl);
});

router.post("/create", (req, res, next) => {
  const { error } = joi.validate(req.body, createAccountWithGoogleSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return googleOauth
    .createAccountFromGoogleInfo(req.body.state, req.body)
    .then(() => res.status(200).json({ created: true }))
    .catch(next);
});

router.get("/callback", (req, res, next) => {
  googleOauth
    .handleOauthCallback(req.query.code, req.query.state)
    .then(state => res.redirect(`/?state=${state}`))
    .catch(err => {
      if (err.error_code) {
        return res.redirect(
          `/?error_code=${err.error_code}&error_message=${err.message}`
        );
      }

      return next(err);
    });
});

export default router;
