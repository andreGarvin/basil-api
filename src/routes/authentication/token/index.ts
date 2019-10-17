import * as jwt from "jsonwebtoken";

// models
import userModel from "../model";

// utils
import ErrorResponse from "../../../common/utils/error";
import logger from "../../../common/logger";

// config
import { USER_TOKEN_EXPIRATION, TOKEN_SECRET } from "../../../config";

// error codes
import AuthenticationError from "../error-codes";
import TokenError from "./error-codes";

// types
import {
  TokenAuthenticationResponse,
  RefreshedToken,
  DecodedToken
} from "./types";
import { UserAccount } from "../types";

/**
 * This function authenticates user tokens
 *
 * @param token The user token
 */
export const authenticate = async (
  token: string
): Promise<TokenAuthenticationResponse> => {
  try {
    const decoedToken = jwt.verify(token, TOKEN_SECRET) as DecodedToken;

    // fetching the user account information
    const user: UserAccount = await userModel.findOne({
      id: decoedToken.user_id,
      school_id: decoedToken.school_id
    });
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

    return {
      user_id: decoedToken.user_id,
      school_id: decoedToken.school_id
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
      logger.child({ error: err }).error("Failed to verify user token");
    }

    throw err;
  }
};

/**
 * This function refreshs a useer token
 *
 * @param token The user token
 */
export const refreshToken = async (userId: string): Promise<RefreshedToken> => {
  try {
    const user: UserAccount = await userModel.findOne({ id: userId });
    if (user === null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "user token does not exist",
        { http_code: 404 }
      );
    }

    // generating a new token
    const refreshedToken: string = jwt.sign(
      {
        user_id: user.id,
        school_code: user.school_id
      },
      TOKEN_SECRET,
      {
        algorithm: "HS256",
        expiresIn: USER_TOKEN_EXPIRATION
      }
    );

    const status = await userModel.updateOne(
      {
        id: user.id,
        school_id: user.school_id
      },
      {
        $set: { token: refreshedToken }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        id: user.id,
        school_id: user.school_id
      });

      logger.child(fields).debug("debugging update query");

      throw new Error(
        "Internal server error, failed to set the new token to user document"
      );
    }

    return {
      user_id: user.id,
      school_id: user.school_id,
      refreshed_token: refreshedToken
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed refresh token");
    }

    throw err;
  }
};
