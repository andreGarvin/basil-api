import * as express from "express";

// utils
import logger from "../../common/logger";

// error codes
import { INTERNAL_SERVER_ERROR } from "../../common/error-codes";

// types
import { ServiceError } from "../../common/utils/error";

export default (): express.ErrorRequestHandler => {
  const ERROR_STATUS_CODE: number = 500;

  return (
    err: Error | ServiceError,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // if the error is a instance of the 'Error' object
    if (err instanceof Error) {
      return res.status(ERROR_STATUS_CODE).json({
        error_code: INTERNAL_SERVER_ERROR,
        message:
          "Something seems to be wrong, this incident has been ackownledged"
      });
    }

    // if the error has the property 'http_code' then set the http status code to the one provided
    let statusCode: number = ERROR_STATUS_CODE;
    if (err.context.http_code) {
      statusCode = err.context.http_code;

      delete err.context.http_code;
    }

    res.status(statusCode).json(err);
  };
};
