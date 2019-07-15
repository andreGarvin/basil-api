import * as express from "express";

export default (req: express.Request, res: express.Response) => {
  return res.status(200).json({ message: 'This service is "running"' });
};
