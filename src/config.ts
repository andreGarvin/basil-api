// utils
import ErrorResponse from "./common/utils/error";

// error code
import { VALIDATION_EXCEPTION } from "./common/error-codes";

export const APP_NAME = process.env.APP_NAME || "pivotlms-api";

// server port number
export const PORT = parseInt(process.env.PORT, 10) || 8081;

export const WEB_APP_HOST = process.env.WEB_APP_HOST;

// This adds any more origins to the origin whit list
const ORIGINS = process.env.ORIGINS
  ? process.env.ORIGINS.split(",").filter(host => host.trim())
  : [];
// default origins that are exposed to make cros origin http request
export const ORIGIN_WHITE_LIST: string[] = [
  ...ORIGINS,
  "http://localhost:8080"
];

export const TOKEN_EXPIRATION =
  parseInt(process.env.TOKEN_EXPIRATION, 10) || 105;

// mongo database connection string

// mongodb test database
const MONGO_TEST_URI = "mongodb://localhost:27017/pivot-dev";

// if tests are running connect the server to a test database
export const MONGO_URI: string =
  process.env.NODE_ENV === "test" ? process.env.MONGO_URI : MONGO_TEST_URI;

export const NO_REPLY = process.env.NO_REPLY || "Pivot <no-reply@pivotlms.com>";

export const ValidationJsonResponse = ErrorResponse(
  VALIDATION_EXCEPTION,
  "There seems to be issue with the information provided",
  {}
);
