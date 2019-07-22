import jwt from "jsonwebtoken";

// models
import userModel from "../model";

// utils
import ErrorResponse from "../../../common/utils/error";
import logger from "../../../common/logger";

// error codes
import AuthenticationError from "../error-codes";
import TokenError from "./error-codes";
import { UserAccount } from "../types";

const TOKEN_EXPIRATION = parseInt(process.env.TOKEN_EXPIRATION, 10) || 105;

export interface DecodedToken {
  user_id: string;
  school_id: string;
}

export interface TokenAuthenticationResponse {
  token?: string;
  user_id: string;
  school_id: string;
  refreshed: boolean;
}

export interface RefreshedToken {
  token: string;
  user_id: string;
  school_id: string;
}

class Token {
  async authenticate(token: string): Promise<TokenAuthenticationResponse> {
    try {
      let decoedToken: DecodedToken;
      try {
        decoedToken = jwt.verify(token, process.env.JSON_WEB_TOKEN_SECERT);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          const refreshedToken: RefreshedToken = await this.refreshToken(token);

          return {
            refreshed: true,
            ...refreshedToken
          };
        }

        if (err.message === "jwt malformed") {
          throw ErrorResponse(
            TokenError.INVALID_TOKEN_EXCEPTION,
            "The token that was provided is invalid",
            400
          );
        }
      }

      // fetching the user account information
      const user: UserAccount = await userModel.findOne({
        id: decoedToken.user_id,
        school_id: decoedToken.school_id
      });
      if (user === null) {
        throw ErrorResponse(
          AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
          "user account does not exist",
          404
        );
      }

      if (!user.verified) {
        throw ErrorResponse(
          AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION,
          "This account has not been verified. Check your email to give the account verification link.",
          401
        );
      }

      if (user.deactivated) {
        throw ErrorResponse(
          AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION,
          "Your account has been deactivated, please check your univeristy email to see why.",
          401
        );
      }

      return {
        refreshed: false,
        user_id: decoedToken.user_id,
        school_id: decoedToken.school_id
      };
    } catch (err) {
      logger.child({ error: err }).error("Failed to fetch user token");

      throw err;
    }
  }

  async refreshToken(token: string): Promise<RefreshedToken> {
    try {
      const user: UserAccount = await userModel.findOne({ token });
      if (user === null) {
        throw ErrorResponse(
          AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
          "user token does not exist",
          404
        );
      }

      const refreshedToken: string = jwt.sign(
        {
          user_id: user.id,
          school_code: user.school_id
        },
        process.env.JSON_WEB_TOKEN_SECERT,
        {
          algorithm: "HS256",
          expiresIn: `${TOKEN_EXPIRATION} days`
        }
      );

      await userModel.updateOne(
        {
          id: user.id,
          school_id: user.school_id
        },
        {
          $set: { token: refreshedToken }
        }
      );

      return {
        user_id: user.id,
        token: refreshedToken,
        school_id: user.school_id
      };
    } catch (err) {
      logger.child({ error: err }).error("Failed refresh token");

      throw err;
    }
  }

  async refreshTokenByUserId(userId: string): Promise<RefreshedToken> {
    try {
      const user: UserAccount = await userModel.findOne({ userId });
      if (user === null) {
        throw ErrorResponse(
          AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
          "user token does not exist",
          404
        );
      }

      const refreshedToken: string = jwt.sign(
        {
          user_id: user.id,
          school_code: user.school_id
        },
        process.env.JSON_WEB_TOKEN_SECERT,
        {
          algorithm: "HS256",
          expiresIn: `${TOKEN_EXPIRATION} days`
        }
      );

      await userModel.updateOne(
        {
          id: user.id,
          school_id: user.school_id
        },
        {
          $set: { token: refreshedToken }
        }
      );

      return {
        user_id: user.id,
        token: refreshedToken,
        school_id: user.school_id
      };
    } catch (err) {
      logger.child({ error: err }).error("Failed refresh token");

      throw err;
    }
  }
}

export default new Token();
