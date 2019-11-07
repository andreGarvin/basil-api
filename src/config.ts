// utils
import ErrorResponse from "./common/utils/error";

// error code
import { VALIDATION_EXCEPTION } from "./common/error-codes";

// server port number
export const PORT = parseInt(process.env.PORT, 10) || 8081;

// mongo database connection string
// this is the test database connection string
const MONGO_TEST_URI = "mongodb://localhost:27017/basil-test";
export const MONGO_URI: string =
  process.env.NODE_ENV === "test" ? MONGO_TEST_URI : process.env.MONGO_URI;

// mobile application deep link
export const HOST = process.env.HOST;
export const APPLICATION_URL = process.env.APPLICATION_URL || "basil://";

// the service name
export const APP_NAME = process.env.APP_NAME || "basil-api";
// this is the email domain
export const BASIL_EMAIL_DOMAIN = process.env.BASIL_EMAIL_DOMAIN || "basil.com";
// this is is for handling emails sent by the service service
export const NO_REPLY =
  process.env.NO_REPLY || `basil <no-reply@${BASIL_EMAIL_DOMAIN}.com>`;

// this is for the platform consumption limitation
// this is the max file size that can be uploaded
export const MAX_FILE_SIZE =
  parseInt(process.env.MAX_FILE_SIZE, 10) || 1024 * 1024;
// this is the character limit for any written information
export const MAX_CHARACTER_LIMIT: number =
  parseInt(process.env.MAX_CHARACTER_LIMIT, 10) || 250;
export const MIN_CHARACTER_LIMIT: number =
  parseInt(process.env.MIN_CHARACTER_LIMIT, 10) || 130;
export const MAX_USERNAME_LENGTH: number =
  parseInt(process.env.MAX_CHARACTER_SIZE, 10) || 30;
// the has salt length for user passwords
export const SALT_LENGTH: number = parseInt(process.env.SALT_LENGTH, 10) || 9;

// this is for token configuration/options
export const USER_TOKEN_EXPIRATION =
  process.env.USER_TOKEN_EXPIRATION || "105 days";
export const TOKEN_SECRET = process.env.JSON_WEB_TOKEN_SECERT;
export const TEMP_TOKEN_EXPIRATION =
  process.env.TEMP_TOKEN_EXPIRATION || "24 hours";

// this is for aws credentionals/options for S3
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "basil/dev";
export const AWS_SECERT_ACCESS_KEY = process.env.AWS_SECERT_ACCESS_KEY;

// this is configuration/credentials needed for google oauth
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const CALLBACK_URL =
  process.env.CALLBACK_URL ||
  `http://localhost:${PORT}/auth/oauth/google/callback`;

// api keys
// giphy api key
export const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
// sendgrid api key
export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// a common validation error response
export const ValidationJsonResponse = (context?: { [key: string]: any }) => {
  return ErrorResponse(
    VALIDATION_EXCEPTION,
    "There seems to be issue with the information provided",
    context
  );
};
