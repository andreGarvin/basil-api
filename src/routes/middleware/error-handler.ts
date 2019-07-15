import * as express from "express";

import logger from "../../common/logger";

import { INTERNAL_SERVER_ERROR } from "../../common/error_codes";

interface ServiceError {
  http_code: number;
  message: string;
  code: string;
}

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
      logger.addFields(err).error("Error caught on middleware");

      return res.status(ERROR_STATUS_CODE).json({
        code: INTERNAL_SERVER_ERROR,
        message: "Something seems to be wrong incident has ackownledged"
      });
    }

    // if the error has the property 'http_code' then set the http status code to the one provided
    let statusCode: number = ERROR_STATUS_CODE;
    if (err.http_code) {
      statusCode = err.http_code;

      delete err.http_code;
    }

    res.status(statusCode).json(err);
  };
};
