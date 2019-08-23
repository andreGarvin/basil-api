import * as express from "express";
const router = express.Router();

// routes
import tokenRoute from "./token/route";

router.use("/token", tokenRoute);

export default router;
