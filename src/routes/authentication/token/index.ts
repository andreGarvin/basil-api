import * as jwt from "jsonwebtoken";

import * as dateFn from "date-fns";

// models
import userModel from "../model";

// utils
import ErrorResponse from "../../../common/utils/error";
import logger from "../../../common/logger";

// config
import {
  USER_TOKEN_EXPIRATION,
  TEMP_TOKEN_EXPIRATION,
  TOKEN_SECRET
} from "../../../config";

// error codes
import AuthenticationError from "../error-codes";
import TokenError from "./error-codes";

// types
import { TokenAuthenticationResponse, DecodedToken } from "./types";
import { UserAccount } from "../types";

/**
 * This function generates a new user jwt and adds
 * the user's email and admin status to the jwt
 *
 * @param email The user email
 * @param isAdmin The user's admin status
 */
export function createUserToken(email: string, isAdmin?: boolean): string {
  const expiresAt = dateFn.addDays(
    new Date(),
    parseInt(USER_TOKEN_EXPIRATION, 10)
  );

  return jwt.sign(
    {
      email,
      is_admin: isAdmin || false,
      expires_at: expiresAt.toString()
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: USER_TOKEN_EXPIRATION
    }
  );
}

/**
 * This function creates a temporary jwt for temporary informattion that needs to be signed
 * and verified if returned back to the service
 *
 * @param context This can be anything
 */
export const createTempToken = (context: any): string => {
  try {
    return jwt.sign(context, TOKEN_SECRET, {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    });
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create temp token");
    }

    throw err;
  }
};

/**
 * This function authenticates user tokens
 *
 * @param token The user token
 */
export const authenticate = async (
  token: string
): Promise<TokenAuthenticationResponse> => {
  try {
    // decoding and verifying user token
    const decoedToken = jwt.verify(token, TOKEN_SECRET) as DecodedToken;

    // fetching the user account information
    const user: UserAccount = await userModel.findOne(
      {
        email: {
          $options: "i",
          $regex: decoedToken.email
        },
        is_admin: decoedToken.is_admin
      },
      {
        id: 1,
        email: 1,
        token: 1,
        is_admin: 1,
        verified: 1,
        suspended: 1,
        deactivated: 1
      }
    );
    if (user === null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "account does not exist",
        { http_code: 404 }
      );
    }

    if (!user.verified) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION,
        "This account has not been verified",
        { http_code: 401 }
      );
    }

    if (user.deactivated) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION,
        "Your account has been deactivated",
        { http_code: 401 }
      );
    }

    if (user.suspended) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_SUSPENDED_EXCEPTION,
        "Your account has been suspended",
        { http_code: 401 }
      );
    }

    return {
      user_id: user.id,
      email: user.email,
      is_admin: user.is_admin,
      // this is a warning to refresh the user jwt
      should_refresh_token: dateFn.isTomorrow(decoedToken.expires_at)
    };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw ErrorResponse(
        TokenError.EXPIRED_TOKEN_EXCEPTION,
        "Token has exipred",
        { http_code: 400 }
      );
    }

    if (err.message === "jwt malformed") {
      throw ErrorResponse(
        TokenError.INVALID_TOKEN_EXCEPTION,
        "The token that was provided is invalid",
        { http_code: 400 }
      );
    }

    if (err.message === "invalid signature") {
      logger.error("Token has a invalid signature");
      throw ErrorResponse(
        TokenError.INVALID_TOKEN_EXCEPTION,
        "The token that was provided is invalid",
        { http_code: 400 }
      );
    }

    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to authenticate the user token");
    }

    throw err;
  }
};

/**
 * This function refreshes a user token
 *
 * @param  userId the id of the user in the users collection
 */
export const refreshToken = async (userId: string): Promise<string> => {
  try {
    const user: UserAccount = await userModel.findOne(
      { id: userId },
      {
        id: 1,
        email: 1,
        is_admin: 1
      }
    );
    if (user === null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "user token does not exist",
        { http_code: 404 }
      );
    }

    // generating a new jwt
    const refreshedToken: string = createUserToken(user.email, user.is_admin);

    const status = await userModel.updateOne(
      {
        id: user.id
      },
      {
        $set: {
          token: refreshedToken
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        user_id: user.id
      });

      logger.child(fields).debug("debugging update query");

      throw new Error(
        "Internal server error, failed to set the new token to user document"
      );
    }

    return refreshedToken;
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed refresh token");
    }

    throw err;
  }
};
