import * as express from "express";
const router = express.Router();

// routes
import health from "./health";

// middlware
import errorHandler from "./middleware/error-handler";
import stateMiddlware from "./middleware/state";

const GIT_SHA: string = process.env.GIT_SHA || "no revision";

// this returns the get sha of the repository
router.get("/version", (req, res) => {
  return res.status(200).json({ revision: GIT_SHA });
});

router.get("/health", health);

router.use(stateMiddlware());

// middlware for handling errors and return error responses
router.use(errorHandler());

export default router;
