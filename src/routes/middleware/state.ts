import * as express from "express";

export default (): express.RequestHandler => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    req.state = {};
    return next();
  };
};
