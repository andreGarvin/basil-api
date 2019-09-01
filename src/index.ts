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
// cross origin middleware
import * as cors from "cors";

// logger util
import logger from "./common/logger";

// api routes
import routes from "./routes";

// config
import { MONGO_URI, ORIGIN_WHITE_LIST, PORT } from "./config";

// this checks if the server has all environment variables needed
if (process.env.NODE_ENV !== "test") {
  const requiredEnvVariables: string[] = [
    "HOST",
    "API_KEY",
    "MONGO_URI",
    "WEB_APP_HOST",
    "GIPHY_API_KEY",
    "SENDGRID_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
    "TEMP_TOKEN_EXPIRATION",
    "USER_TOKEN_EXPIRATION",
    "JSON_WEB_TOKEN_SECERT",
    "AWS_SECERT_ACCESS_KEY"
  ];

  const missingEnvVariables: string[] = [];
  requiredEnvVariables.forEach(env => {
    if (typeof process.env[env] === "undefined") {
      missingEnvVariables.push(env);
    }
  });

  if (missingEnvVariables.length !== 0) {
    logger.warn(
      "YOU ARE MISSING THESE ENVIRONMENTAL VARIABLES [ %s ]",
      missingEnvVariables.join(", ")
    );

    process.exit(1);
  }
}

// MONGODB connection
mongoose.connect(MONGO_URI, { useNewUrlParser: true });

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

// middleware

// http header protection
app.use(helmet());

// JSON body parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* This allows other web applications to make http requests to
the api, meaning websites that are not of the same origin or
host only whitelisted ports */
app.use(cors({ origin: ORIGIN_WHITE_LIST }));

/* routes */

app.use(routes);
