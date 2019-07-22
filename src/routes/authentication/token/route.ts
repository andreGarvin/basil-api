import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// modules
import token from "./index";

// middleware
import authenticationMilddlewarePipeline from "../middleware/authentication";

// error codes
import AuthenticationError from "../error-codes";
import TokenError from "./error-codes";

// authenticates a user token
router.post("/authenticate", (req, res, next) => {
  // extracts the user token from request headers
  const USER_TOKEN: string = req.get("x-token");

  // validating the token provided
  const { error } = joi.validate(USER_TOKEN, joi.string().required());
  if (error) {
    return res.status(400).json({
      message: error.message,
      error_code: TokenError.INVALID_TOKEN_EXCEPTION
    });
  }

  // checking the token authentication type
  const [AUTH_TYPE, TOKEN]: string[] = USER_TOKEN.split(" ");
  if (AUTH_TYPE !== "Bearer") {
    throw {
      message: "Invalid token authorization type",
      error_code: AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION
    };
  }

  return token
    .authenticate(TOKEN)
    .then(tokenInfo => res.status(200).json(tokenInfo))
    .catch(next);
});

// refreshes the user token and returns back the new token
router.put(
  "/refresh",
  authenticationMilddlewarePipeline,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return token
      .refreshTokenByUserId(req.state.user)
      .then(resfreshedToken => res.status(200).json(resfreshedToken))
      .catch(next);
  }
);

export default router;
