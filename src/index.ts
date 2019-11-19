// requires dotenv module if in developement mode or testing
import * as dotenv from "dotenv";
dotenv.config();

// web framework
import * as express from "express";
const app = express();

// http server module and passing app into
import * as http from "http";

const server = new http.Server(app);
// exporting the server to be consumed by socket.io in the sockets file
export default server;

// DRM for mongodb
import * as mongoose from "mongoose";

// JSON request data parser
import * as bodyParser from "body-parser";
// express middleware for headers
import * as helmet from "helmet";

// config validation util
import configValidation from "./common/utils/config-validation";

// logger util
import logger from "./common/logger";

// api routes
import routes from "./routes";

// config
import { MONGO_URI, PORT } from "./config";

import * as types from "./types";

declare global {
  namespace Express {
    export interface Request {
      state?: types.State;
    }
  }

  namespace express {
    export interface Request {
      state?: types.State;
    }
  }
}

if (process.env.NODE_ENV !== "test") {
  configValidation(process.env);
}

// middleware

// http header protection
app.use(helmet());

// JSON body parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* routes */

app.use(routes);

// MONGODB connection
mongoose.connect(MONGO_URI, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on("connected", err => {
  if (err) {
    logger.child({ error: err }).error("FAILED TO CONNECT TO MONGO DATABASE");

    return process.exit(1);
  }

  logger.info("CONNECTED TO MONGO DATABASE");

  /* checks if the index.js file is being required in a different
    file, else this would start the server again to listen on the
    port being occupied */
  if (require.main === module) {
    server.listen(PORT, () => {
      logger.info(`RUNNING SERVER ON [PORT:%s]`, PORT);

      if (process.env.NODE_ENV === "dev") {
        console.log(`Press ctl^c to quit\n`);
      }
    });
  }
});

mongoose.connection.on("disconnected", () => {
  if (process.env.NODE_ENV !== "test") {
    logger.error("DISCONNECTED FROM MONGODB");

    process.exit(1);
  }
});
