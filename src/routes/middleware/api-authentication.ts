import * as express from "express";

import * as joi from "joi";

// utils
import logger from "../../common/logger";

// error codes
import AuthenticationError from "../authentication/error-codes";

export default function apiAuthentication(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    // checking of the api key was provided in the headers for the api endpoint
    const API_KEY = req.headers["x-api-key"];
    if (API_KEY) {
      // validating the api key is not a empty string
      const { error } = joi.validate(
        API_KEY,
        joi
          .string()
          .required()
          .error(new Error(`No valid api key was provided`))
      );
      if (error) {
        logger.warn("Invalid api key content");
        logger.debug(error);

        return res.status(401).json({
          message: "Invalid api key",
          error_code: AuthenticationError.UNAUTHORIZED_EXCEPTION
        });
      }

      // checking if the api matches the servers api key in the envrionment
      if (process.env.API_KEY !== API_KEY) {
        return res.status(401).json({
          message: "Unauthorized",
          error_code: AuthenticationError.UNAUTHORIZED_EXCEPTION
        });
      }

      return next();
    }

    return res.status(401).json({
      message: "No valid api key was provided",
      error_code: AuthenticationError.UNAUTHORIZED_EXCEPTION
    });
  } catch (err) {
    logger.error("exception thrown on api authentication middleware", err);

    return next(err);
  }
}
