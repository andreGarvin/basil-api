import * as url from "url";

import * as jwt from "jsonwebtoken";
import { google } from "googleapis";

// utils
import ErrorResponse from "../../../common/utils/error";
import logger from "../../../common/logger";

// config
import * as config from "../../../config";

// models
import googleAccessTokenModel from "./model";
import userModel from "../model";

// modules
import { createUserToken, createTempToken } from "../token";
import { sendVerificationEmail } from "..";

// error codes
import AuthenticationError from "../error-codes";
import UserError from "../../user/error-codes";
import GoogleOauthError from "./error-codes";

const authentication = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.CALLBACK_URL
);

const googleConstentScopes = [
  "https://www.googleapis.com/auth/plus.me",
  "profile",
  "email"
];

// enums
export enum OauthStateAction {
  CREATE_ACCOUNT = "CREATE_ACCOUNT",
  LOGIN = "LOGIN"
}

// interfaces
interface OauthState {
  email?: string;
  action: OauthStateAction;
}

interface UserGoogleTokens {
  id_token: string;
  expires_at: number;
  access_token: string;
  refresh_token: string;
}

interface NewUserInfo {
  gender: string;
  username: string;
  display_name: string;
  date_of_birth: string;
}

// this is the interface for what the stored data will look like in the google_access_tokens collection
export interface GoogleAccessTokens extends UserGoogleTokens {
  email: string;
}

/**
 * This checks if the user has authenticated against google and has been stored in the
 * google_access_tokens collection
 *
 * @param tokens This is the user's google access tokens
 */
async function authenticateUser(tokens: UserGoogleTokens): Promise<string> {
  try {
    const decodedIdToken = jwt.decode(tokens.id_token) as { email: string };

    // checks if the access token and exipre time exist
    const userGoogleAccessToken = await googleAccessTokenModel.findOne(
      {
        email: {
          $options: "i",
          $regex: decodedIdToken.email
        }
      },
      { email: 1 }
    );
    if (userGoogleAccessToken === null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "this user does not exist",
        {
          http_code: 400
        }
      );
    }

    // fetching the user's information
    const account = await userModel.findOne(
      {
        email: {
          $options: "i",
          $regex: userGoogleAccessToken.email
        }
      },
      { token: 1 }
    );
    if (account === null) {
      logger
        .child({ email: userGoogleAccessToken.email })
        .warn("Failed to fetch user account from users collection");

      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "this user does not exist",
        {
          http_code: 400
        }
      );
    }

    return account.token;
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to authenticate google user");
    }

    throw err;
  }
}

/**
 * This function sets the user's google access token into the google_access_tokens collection
 * and returns a oauth for a CREATE_ACCOUNT action
 *
 * @param tokens This is the user's access tokens provided by google
 */
async function setUserTokens(tokens: UserGoogleTokens): Promise<string> {
  try {
    const decodedIdToken = jwt.decode(tokens.id_token) as { email: string };
    const userEmail: string = decodedIdToken.email;

    // checks if the user does not exist
    const userAccessTokens = await googleAccessTokenModel.findOne({
      email: {
        $options: "i",
        $regex: userEmail
      }
    });
    if (userAccessTokens === null) {
      // creates a new record of the user's google access token
      const newGoogleAccessTokens = new googleAccessTokenModel({
        email: userEmail,
        id_token: tokens.id_token,
        expires_at: tokens.expires_at,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      });

      await newGoogleAccessTokens.save();
    }

    // creating the a oauth state jwt for creating a user account
    return createTempToken({
      email: userEmail,
      action: OauthStateAction.CREATE_ACCOUNT
    });
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to set user google access tokens");
    }

    throw err;
  }
}

/**
 * This function create a new user account using the user's google
 * profile infornation
 *
 * @param state The oauth state provided by the service
 * @param userInfo The user's new profile information
 */
export async function createAccountFromGoogleInfo(
  state: string,
  userInfo: NewUserInfo
): Promise<void> {
  try {
    // verifying and decoding the oauth state
    const decodedTokenState = jwt.verify(
      state,
      config.TOKEN_SECRET
    ) as OauthState;

    if (!decodedTokenState.email) {
      throw ErrorResponse(
        GoogleOauthError.OAUTH_STATE_EMAIL_INVALID_EXCEPTION,
        "The email in the oauth state is not provided",
        { http_code: 400 }
      );
    }

    // checking if the user has oauth against google before creating a account
    const userAccessTokens = await googleAccessTokenModel.findOne(
      {
        email: {
          $options: "i",
          $regex: decodedTokenState.email
        }
      },
      {
        email: 1,
        id_token: 1
      }
    );
    if (userAccessTokens !== null) {
      throw ErrorResponse(
        GoogleOauthError.USER_NOT_FOUND_EXCEPTION,
        "this user has not oauth against google",
        { http_code: 401 }
      );
    }

    // checking if the user account exist
    const user = await userModel.findOne({
      email: {
        $options: "i",
        $regex: userAccessTokens.email
      }
    });
    if (user !== null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_EXIST_EXCEPTION,
        "This account already exist",
        {
          http_code: 400
        }
      );
    }

    // checking if the user account exist
    const account = await userModel.findOne({
      username: {
        $options: "i",
        $regex: userInfo.username
      }
    });
    if (account !== null) {
      throw ErrorResponse(
        UserError.USERNAME_EXIST_EXCEPTION,
        "This username taken",
        {
          http_code: 400
        }
      );
    }

    const decodedIdToken = jwt.decode(userAccessTokens.id_token) as {
      name: string;
      picture: string;
    };

    const isAdmin = userAccessTokens.email.endsWith(`@${config.ORG_DOMAIN}`);

    // creating the user token
    const userToken = createUserToken(userAccessTokens.email, isAdmin);

    const newAccount = new userModel({
      suspended: false,
      token: userToken,
      is_admin: isAdmin,
      gender: userInfo.gender,
      is_google_account: true,
      email: userAccessTokens.email,
      display_name: decodedIdToken.name,
      photo_url: decodedIdToken.picture,
      date_of_birth: userInfo.date_of_birth,
      username: userInfo.username.toLowerCase()
    });

    await newAccount.save();

    // sending verification email to the user's inbox in order to verify their email address
    await sendVerificationEmail(userAccessTokens.email);
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to create user account with google information");
    }

    throw err;
  }
}

export function createOauthUrl(oauthStateAction: OauthStateAction): string {
  // creating the a oauth user jwt
  const oauthState = createTempToken({
    action: oauthStateAction
  });

  const oauthUrl = authentication.generateAuthUrl({
    scope: googleConstentScopes,
    access_type: "offline",
    prompt: "consent"
  });

  const newOauthUrl = new url.URL(oauthUrl);
  newOauthUrl.searchParams.set("state", oauthState);

  return newOauthUrl.toString();
}

export async function handleOauthCallback(
  code: string,
  state: string
): Promise<string | void> {
  try {
    const decodedTokenState = jwt.verify(
      state,
      config.TOKEN_SECRET
    ) as OauthState;

    const data = await authentication.getToken(code);

    const userGoogleAccessToken = {
      id_token: data.tokens.id_token,
      expires_at: data.tokens.expiry_date,
      access_token: data.tokens.access_token,
      refresh_token: data.tokens.refresh_token
    };

    if (decodedTokenState.action === OauthStateAction.LOGIN) {
      // this returns the user's token to authenticate with the service
      return await authenticateUser(userGoogleAccessToken);
    } else if (decodedTokenState.action === OauthStateAction.CREATE_ACCOUNT) {
      // this returns a new oauth state for the user to create their account
      return await setUserTokens(userGoogleAccessToken);
    }

    logger.error("There was no oauth state action");

    throw ErrorResponse(
      GoogleOauthError.FAILED_OAUTH_EXCEPTION,
      "oauth failed"
    );
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("google oauth callback failed");
    }

    throw err;
  }
}
