import * as express from "express";

import * as joi from "joi";

// controllers
import token from "../index";

// utils
import logger from "../../../../common/logger";

// error codes
import AuthenticationError from "../../error-codes";

export default (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // check if a user token was provided
  const USER_TOKEN: string = req.get("x-token");
  if (!USER_TOKEN) {
    return next();
  }

  const { error } = joi.validate(USER_TOKEN, joi.string().required());
  if (error) {
    logger.warn(error.message);

    return res.status(400).json({
      message: "The Provided token is invalid",
      error_code: AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION
    });
  }

  const [AUTHTYPE, TOKEN]: string[] = USER_TOKEN.split(" ");
  // checks if the x-token headers has the 'Bearer' type
  if (AUTHTYPE !== "Bearer") {
    return res.status(400).json({
      message: "Invalid token authorization type",
      error_code: AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION
    });
  }

  if (!TOKEN) {
    return res.status(400).json({
      error_code: AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION,
      message: "Token was not provided, token authentication request invalid"
    });
  }

  // if the request is authenticate a token, forward on the request
  if (req.path === "/auth/token/authenticate") {
    return next();
  }

  // authenticating token
  return token
    .authenticate(TOKEN)
    .then(tokenInfo => {
      // setting the user.uid to the req.user
      req.state.user = tokenInfo.user_id;
      return next();
    })
    .catch(err => {
      if (err instanceof Error) {
        logger
          .child({ error: err })
          .error("Error on token authentication middleware");
      }

      return next(err);
    });
};
