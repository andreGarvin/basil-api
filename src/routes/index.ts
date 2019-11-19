import * as express from "express";
const router = express.Router();

// config
import { APP_NAME } from "../config";

// routes
import authentication from "./authentication/route";
// import messenger from "./messenger/route";
import user from "./user/route";
import health from "./health";

// middlwares
import authenticationMiddleware from "./authentication/middleware/authentication";
import errorHandler from "./middleware/error-handler";
import httpLogger from "./middleware/http-logger";
import stateMiddlware from "./middleware/state";

// express http request logger
router.use(httpLogger());

const GIT_SHA: string = process.env.GIT_SHA || "no revision";

// this returns the get sha of the repository
router.get("/version", (req, res) => {
  return res.status(200).json({ revision: GIT_SHA, service: APP_NAME });
});

router.get("/health", health);

router.use(stateMiddlware());

// routes
router.use("/auth", authentication);
router.use("/api/user", authenticationMiddleware, user);
// router.use("/api/messenger", authenticationMiddleware, messenger);

// middlware for handling errors and return error responses
router.use(errorHandler());

router.use((req, res, next) => {
  res.status(404).json({
    message: "This route does not exist",
    code: "NOT_FOUND"
  });
});

export default router;
