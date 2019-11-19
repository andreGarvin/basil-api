import * as joi from "joi";

import * as express from "express";
const router = express.Router();

// config
import { APPLICATION_URL } from "../../config";

// module
import * as authentication from "./index";

// routes
import googleOauthRoute from "./google-oauth/route";
import tokenRoute from "./token/route";

// utils
import {
  joiValidateResponse,
  ValidationJsonResponse
} from "../../common/utils/validation-response";

// middleware
import authenticationMiddleware from "./middleware/authentication";

// request schemas
import {
  BasicAuthenticationSchema,
  updatePasswordSchema,
  resetPasswordSchema,
  createAccountSchema,
  emailObjectSchema
} from "./request-schemas";

// extended authentication routes
router.use("/token", tokenRoute);
router.use("/oauth/google", googleOauthRoute);

router.post("/create", (req, res, next) => {
  const { error } = joi.validate(req.body, createAccountSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return authentication
    .createAccount(req.body)
    .then(() => res.status(201).json({ created: true }))
    .catch(next);
});

router.post("/send/verification", (req, res, next) => {
  const { error } = joi.validate(req.body, emailObjectSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return authentication
    .sendVerificationEmail(req.body.email)
    .then(() => res.status(200).json({ sent: true }))
    .catch(next);
});

router.post("/send/reset-password", (req, res, next) => {
  const { error } = joi.validate(req.body, emailObjectSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return authentication
    .sendResetPasswordEmail(req.body.email)
    .then(() => res.status(200).json({ sent: true }))
    .catch(next);
});

router.post("/reset-password", (req, res, next) => {
  const { error } = joi.validate(req.body, resetPasswordSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return authentication
    .resetPassword(req.body.tmp_token, req.body.new_password)
    .then(() => res.status(200).json({ updated: true }))
    .catch(next);
});

router.put("/update-password", authenticationMiddleware, (req, res, next) => {
  const { error } = joi.validate(req.body, updatePasswordSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return authentication
    .updatePassword(
      req.state.user,
      req.body.old_password,
      req.body.new_password
    )
    .then(() => res.status(200).json({ updated: true }))
    .catch(next);
});

router.post("/authenticate", (req, res, next) => {
  const { error } = joi.validate(req.body, BasicAuthenticationSchema, {
    abortEarly: false
  });
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  const { email, password } = req.body;
  return authentication
    .authenticate(email, password)
    .then(userCredentials => res.status(200).json(userCredentials))
    .catch(next);
});

router.get("/verify/:verification_token", (req, res, next) => {
  return authentication
    .verifyAccount(req.params.verification_token)
    .then(() => res.redirect(APPLICATION_URL))
    .catch(err => {
      if (err instanceof Error) {
        return next(err);
      }

      res.redirect(APPLICATION_URL);
    });
});

router.get("/reactivate", (req, res, next) => {
  const token = req.query.token;
  if (typeof token !== "string") {
    return res.redirect(APPLICATION_URL);
  }

  return authentication
    .reactivateAccount(token)
    .then(() => res.redirect(APPLICATION_URL))
    .catch(err => {
      if (err instanceof Error) {
        return next(err);
      }

      res.redirect(APPLICATION_URL);
    });
});

export default router;
