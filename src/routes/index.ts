import * as express from "express";
const router = express.Router();

// routes
import invitation from "./invitation/route";
import registry from "./registry/route";
import health from "./health";

// middlware
import errorHandler from "./middleware/error-handler";
import stateMiddlware from "./middleware/state";

const GIT_SHA: string = process.env.GIT_SHA || "no revision";

// this returns the get sha of the repository
router.get("/version", (req, res) => {
  return res
    .status(200)
    .json({ revision: GIT_SHA, service: process.env.APP_NAME });
});

router.get("/health", health);

router.use(stateMiddlware());

// routes
router.use("/api/registry", registry);
router.use("/api/invitation", invitation);

// middlware for handling errors and return error responses
router.use(errorHandler());

export default router;
