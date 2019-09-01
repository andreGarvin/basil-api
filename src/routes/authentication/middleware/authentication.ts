import * as express from "express";

// middlware
// import basicAuthenticationMiddleware from "./basic_authentication";
import tokenAuthenticationMiddleware from "../token/middleware/token-authentication";

// utils
import logger from "../../../common/logger";

// error code
import AuthenticationError from "../error-codes";

/**
 * This middleware checks if the any incoming request has been authenticated
 */
const authenticationMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // Checking if the req.state.user was set
  if (req.state.user) {
    return next();
  }

  logger.debug("state", req.state);

  return res.status(401).json({
    message: "You are not authenticated",
    error_code: AuthenticationError.UNAUTHORIZED_EXCEPTION
  });
};

export default [tokenAuthenticationMiddleware, authenticationMiddleware];
