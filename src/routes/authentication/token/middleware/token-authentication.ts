import * as express from "express";

import * as joi from "joi";

// import * as dateFn from "date-fns";

// modules
import * as token from "../index";

// config
import { ValidationJsonResponse } from "../../../../common/utils/validation-response";

// utils
import logger from "../../../../common/logger";

// error codes
import AuthenticationError from "../../error-codes";

const tokenAuthenticationMiddlewre = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // check if a user token was provided
  const USER_TOKEN: string = req.get("x-token");

  const { error } = joi.validate(USER_TOKEN, joi.string().required());
  if (error) {
    logger
      .child({ _message: "authentication token not provided" })
      .debug(error.message);

    return res.status(401).json({
      message: "authentication token not provided",
      error_code: AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
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
    return res.status(400).json(ValidationJsonResponse());
  }

  // authenticating token
  return token
    .authenticate(TOKEN)
    .then(tokenInfo => {
      // setting the user.uid to the req.user
      req.state.user = tokenInfo.user_id;
      return next();
    })
    .catch(next);
};

export default tokenAuthenticationMiddlewre;
