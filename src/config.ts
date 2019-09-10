// utils
import ErrorResponse from "./common/utils/error";

// error code
import { VALIDATION_EXCEPTION } from "./common/error-codes";

export const APP_NAME = process.env.APP_NAME || "pivotlms-api";

// server port number
export const PORT = parseInt(process.env.PORT, 10) || 8081;

export const WEB_APP_HOST = process.env.WEB_APP_HOST;

// this is the character limit of the workspace description
export const CHARACTER_LIMIT: number = 130;

// This adds any more origins to the origin whit list
const ORIGINS = process.env.ORIGINS
  ? process.env.ORIGINS.split(",").filter(host => host.trim())
  : [];

// default origins that are exposed to make cros origin http request
export const ORIGIN_WHITE_LIST: string[] = [
  ...ORIGINS,
  "http://localhost:8080"
];

export const USER_TOKEN_EXPIRATION =
  process.env.USER_TOKEN_EXPIRATION || "105 days";
export const TOKEN_SECRET = process.env.JSON_WEB_TOKEN_SECERT;
export const TEMP_TOKEN_EXPIRATION =
  process.env.TEMP_TOKEN_EXPIRATION || "24 hours";

// mongo database connection string
// mongodb test database
const MONGO_TEST_URI = "mongodb://localhost:27017/pivotlms-test";

// if tests are running connect the server to a test database
export const MONGO_URI: string =
  process.env.NODE_ENV === "test" ? MONGO_TEST_URI : process.env.MONGO_URI;

export const NO_REPLY =
  process.env.NO_REPLY || "Pivotlms <no-reply@pivotlms.com>";

export const MAX_FILE_SIZE =
  parseInt(process.env.MAX_FILE_SIZE, 10) || 1024 * 1024;

export const ValidationJsonResponse = (context?: { [key: string]: any }) => {
  return ErrorResponse(
    VALIDATION_EXCEPTION,
    "There seems to be issue with the information provided",
    context
  );
};
