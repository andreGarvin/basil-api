import * as express from "express";

// models
import invitationModel from "./invitation/model";
import userModel from "./authentication/model";
import registryModel from "./registry/model";

// utils
import logger from "../common/logger";

/**
 * This function runs a select one query on all of the collections in the database
 * to check if all queries were successful and that the server is still connected
 * to the database
 */
const heavyCheck = async (): Promise<void> => {
  try {
    await userModel.find({}).limit(1);
    await registryModel.find({}).limit(1);
    await invitationModel.find({}).limit(1);
  } catch (err) {
    logger.child({ error: err }).error("Internal error, A query failed");

    throw err;
  }
};

export default (req: express.Request, res: express.Response) => {
  if (req.query.heavy !== "true") {
    return res.status(200).json({ message: 'This service is "running"' });
  }

  return heavyCheck()
    .then(() =>
      res.status(200).json({
        message:
          "Service is still running and all queries have succesfully executed"
      })
    )
    .catch(() =>
      res.status(500).json({ message: "Service is running but a query failed" })
    );
};
