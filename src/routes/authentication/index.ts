import * as crypto from "crypto";
import { URL } from "url";

import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";

// config
import {
  // APPLICATION_URL,
  MAX_USERNAME_LENGTH,
  BASIL_EMAIL_DOMAIN,
  TOKEN_SECRET,
  SALT_LENGTH,
  NO_REPLY,
  HOST
} from "../../config";

// models
import userModel from "./model";

// modules
import * as token from "./token";

// utils
import ErrorResponse from "../../common/utils/error";
import {
  sendEmailTemplate,
  TEMPLATES
} from "../../common/utils/send-email-template";
import logger from "../../common/logger";

// error codess
import AuthenticationError from "./error-codes";
import TokenError from "./token/error-codes";

// types
import { NewUserInfo, AccountCredentials } from "./types";
import UserError from "../user/error-codes";

const AVATAR_PHOTO_URL = "https://www.gravatar.com/avatar";

/**
 * This function checks if the users password is unique
 *
 * @param password a password
 */
const uniquePassword = (
  password: string
): null | { [key: string]: boolean } => {
  const error = {
    NO_NUMBER: !/\d{1}/.test(password),
    NO_CAPITAL_LETTER: !/[A-Z]{1}/.test(password),
    PASSWORD_LENGTH: password.length < 8 && password.length > 15,
    SPECIAL_CHARACTER: !/\W{1}/.test(password) && !/_/.test(password)
  };

  const bool =
    !error.NO_NUMBER &&
    !error.PASSWORD_LENGTH &&
    !error.NO_CAPITAL_LETTER &&
    !error.SPECIAL_CHARACTER;

  return bool === false ? error : null;
};

/**
 * This function authenicates a user by using their email and password
 * and returns the user credentials
 *
 * @param email the user's emaoil
 * @param password The user's password
 */
export const authenticate = async (
  email: string,
  password: string
): Promise<AccountCredentials> => {
  try {
    // retrieves the user account by email
    const account = await userModel.findOne(
      {
        email: {
          $options: "i",
          $regex: email
        }
      },
      // only returning the information that was needed
      {
        id: 1,
        hash: 1,
        token: 1,
        email: 1,
        is_admin: 1,
        verified: 1,
        deactivated: 1
      }
    );
    // check if the user account exist
    if (account === null) {
      throw ErrorResponse(
        AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION,
        "Incorrect email or password",
        { http_code: 400 }
      );
    }

    // checking the user password is correct
    if (!bcrypt.compareSync(password, account.hash)) {
      throw ErrorResponse(
        AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION,
        "Incorrect email or password",
        { http_code: 401 }
      );
    }

    if (account.deactivated) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION,
        "Your account has been deactivated",
        { http_code: 401 }
      );
    }

    if (!account.verified) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION,
        "This account has not been verified",
        { http_code: 401 }
      );
    }

    // each time a user logs in to their account the this field is updated
    await userModel.updateOne(
      { id: account.id },
      {
        $set: {
          last_login_at: new Date().toISOString()
        }
      }
    );

    return {
      user_id: account.id,
      email: account.email,
      token: account.token,
      is_admin: account.is_admin
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to autenticate using basic authentication method");
    }

    throw err;
  }
};

/**
 * This function creates and inserts a new user information into the users
 * collection
 *
 * @param userInfo The user info provided to create the account
 */
export const createAccount = async (userInfo: NewUserInfo): Promise<void> => {
  try {
    // checking the user account already exist under the same email
    const user = await userModel.findOne({
      email: {
        $options: "i",
        $regex: userInfo.email
      }
    });
    if (user !== null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_EXIST_EXCEPTION,
        "Account already exist",
        { http_code: 400 }
      );
    }

    if (userInfo.username.length > MAX_USERNAME_LENGTH) {
      throw ErrorResponse(
        UserError.MAX_USERNAME_LENGTH_EXCEPTION,
        "This user is more then 30 characters",
        { http_code: 400 }
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
        "This username is taken",
        { http_code: 400 }
      );
    }

    // checking if the users password is unique
    const err = uniquePassword(userInfo.password);
    if (err) {
      throw ErrorResponse(
        AuthenticationError.UNIQUE_PASSWORD_EXCEPTION,
        "Please check over your password",
        { errors: err, http_code: 400 }
      );
    }

    // checking a default profile photo for the user account
    const md5Hash = crypto
      .createHash("md5")
      .update(userInfo.email)
      .digest("hex");

    // the user profile photo url
    const avatarPhotoUrl = new URL(AVATAR_PHOTO_URL);
    avatarPhotoUrl.pathname = md5Hash;
    avatarPhotoUrl.searchParams.append("d", "identicon");

    const isAdmin = userInfo.email.endsWith(BASIL_EMAIL_DOMAIN);

    // creating a new jwt for the user account
    const newUserToken = token.createUserToken(userInfo.email, isAdmin);

    const newUser: any = new userModel({
      is_admin: isAdmin,
      token: newUserToken,
      email: userInfo.email,
      gender: userInfo.gender,
      is_google_account: false,
      photo_url: avatarPhotoUrl.href,
      display_name: userInfo.display_name,
      date_of_birth: userInfo.date_of_birth,
      username: userInfo.username.toLowerCase(),
      // generating a hashed password
      hash: bcrypt.hashSync(userInfo.password, SALT_LENGTH)
    });

    await newUser.save();

    // sending verification email to the user's inbox in order to verify their email address
    await sendVerificationEmail(newUser.email);
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create user account");
    }

    throw err;
  }
};

/**
 * This function updates the user hash in the users collection
 *
 * @param userId The user id
 * @param oldPassword The old user password
 * @param newPassword The new user password
 */
export const updatePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  try {
    // checking if user account exist
    const account = await userModel.findOne({ id: userId }, { hash: 1 });
    if (account === null) {
      logger.error("Internal server error, user account was not found");

      throw new Error("Internal server error, user account was not found");
    }

    // checking if the old password is correct
    if (!bcrypt.compareSync(oldPassword, account.hash)) {
      throw ErrorResponse(
        AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION,
        "The old password is incorrect",
        { http_code: 400 }
      );
    }

    // checking if the new password is the same as the old password
    if (newPassword === oldPassword) {
      throw ErrorResponse(
        AuthenticationError.NEW_PASSWORD_EXCEPTION,
        "The new password is the same as the old password",
        { http_code: 400 }
      );
    }

    // checking if the users password is unique
    const err = uniquePassword(newPassword);
    if (err) {
      throw ErrorResponse(
        AuthenticationError.UNIQUE_PASSWORD_EXCEPTION,
        "Please check over your password",
        { errors: err, http_code: 400 }
      );
    }

    // creating a new hash of the new user password
    const hash = bcrypt.hashSync(newPassword, SALT_LENGTH);

    const status = await userModel.updateOne(
      { id: userId },
      { $set: { hash } }
    );
    if (status.n === 0) {
      logger.child(status).debug("debugging update query");

      throw new Error(
        "Intsernal server error, failed to update the user hash in the users collection"
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed update user password");
    }

    throw err;
  }
};

/**
 * This function sends a verification email to the user email inbox top verify
 * their user account
 *
 * @param email The user's email
 */
export const sendVerificationEmail = async (email: string): Promise<void> => {
  try {
    const account = await userModel.findOne({
      email: {
        $options: "i",
        $regex: email
      }
    });
    if (account === null) {
      logger.child({ email }).debug("Account did not exist");
      return;
    }

    if (account.deactivated) {
      logger
        .child({ email })
        .warn("Attempting to verify a deactivated account");
      return;
    }

    if (account.verified) {
      logger.child({ email }).warn("Attempting to update a verified account");
      return;
    }

    // creating a temporary account verification token
    const verificationTempToken = token.createTempToken({
      email: account.email
    });

    // creating a link to the verify api endpoint
    // #TODO: Need to change this to the mobile application deep link
    const verificationLink = new URL(HOST);
    verificationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
    verificationLink.pathname = `/auth/verify/${verificationTempToken}`;

    // sending the template email
    await sendEmailTemplate(
      TEMPLATES.ACCOUNT_VERIFICATION,
      {
        from: NO_REPLY,
        to: account.email,
        subject: "Basil account verification"
      },
      {
        link: verificationLink.href
      }
    );
  } catch (err) {
    logger.child({ error: err }).error("Failed to send verification email");

    throw err;
  }
};

/**
 * This function sends a email to the user to reset password to their account
 *
 * @param email The email of the user
 */
export const sendResetPasswordEmail = async (email: string): Promise<void> => {
  try {
    const account = await userModel.findOne({
      email: {
        $options: "i",
        $regex: email
      }
    });
    if (account === null) {
      logger.child({ email }).debug("Account did not exist");
      return;
    }

    if (!account.verified) {
      logger.child({ email }).warn("Attempting to update a verified account");

      throw ErrorResponse(
        AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION,
        "This account has not be verified",
        { http_code: 400 }
      );
    }

    if (account.deactivated) {
      logger
        .child({ email })
        .warn("Attempting to verify a deactivated account");
      return;
    }

    const status = await userModel.updateOne(
      { id: account.id },
      {
        $set: { deactivated: true }
      }
    );

    if (status.n === 0) {
      logger.child(status).debug("debugging update query");

      throw new Error(
        "Internal server error, failed to deactivate the user account"
      );
    }

    // creating a temporary reset password/ account reactivation token
    const resetPasswordToken = token.createTempToken({
      email: account.email
    });

    // forming link to reset password api endpoint
    // #TODO: Need to change this to the mobile application deep link
    const resetPasswordLink = new URL(HOST);
    resetPasswordLink.protocol = process.env.IS_DOCKER ? "https" : "http";
    resetPasswordLink.pathname = `/auth/reset-password/${resetPasswordToken}`;

    // forming link to account reactivation api endpoint
    const reactivationPasswordLink = new URL(process.env.HOST);
    reactivationPasswordLink.protocol = process.env.IS_DOCKER
      ? "https"
      : "http";
    reactivationPasswordLink.pathname = `/auth/reactivate/${resetPasswordToken}`;

    await sendEmailTemplate(
      TEMPLATES.ACCOUNT_PASSWORD_RESET,
      {
        from: NO_REPLY,
        to: account.email,
        subject: "Password reset for account on basil"
      },
      {
        reactivation_link: resetPasswordLink.href,
        reset_password_link: resetPasswordLink.href
      }
    );
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to send reset password email");
    }

    throw err;
  }
};

// interface for temporary authentication token
interface DecoedTempToken {
  email: string;
}

/**
 * This function update the user's hash on the new password and is authenticating/authorizing the user
 * by a temporary json web token being used the authenticate the user
 *
 * @param resetPasswordToken The temp json web token
 * @param oldPassword the old user password
 * @param newPassword the new user password
 */
export const resetPassword = async (
  resetPasswordToken: string,
  newPassword: string
): Promise<void> => {
  try {
    const decoedToken = jwt.verify(
      resetPasswordToken,
      TOKEN_SECRET
    ) as DecoedTempToken;

    const account = await userModel.findOne(
      {
        email: {
          $options: "i",
          $regex: decoedToken.email
        }
      },
      {
        id: 1,
        hash: 1,
        deactivated: 1
      }
    );
    if (account === null) {
      logger
        .child({
          email: decoedToken.email
        })
        .warn("user account was not found");

      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "This account does not exist",
        { http_code: 400 }
      );
    }

    if (!account.deactivated) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_ACTIVATED_EXCEPTION,
        "Account is activated",
        { http_code: 400 }
      );
    }

    // checking if the new password is not the same as the old password
    if (bcrypt.compareSync(newPassword, account.hash)) {
      throw ErrorResponse(
        AuthenticationError.UPDATE_PASSWORD_EXCEPTION,
        "The new password is the same as the old password",
        { http_code: 400 }
      );
    }

    // checking if the new user password is unique
    const err = uniquePassword(newPassword);
    if (err) {
      throw ErrorResponse(
        AuthenticationError.UNIQUE_PASSWORD_EXCEPTION,
        "Please check over your password",
        { errors: err, http_code: 400 }
      );
    }

    // creating a new hash of the new user password
    const newUserHash = bcrypt.hashSync(newPassword, SALT_LENGTH);

    const status = await userModel.updateOne(
      { id: account.id },
      {
        $set: {
          hash: newUserHash,
          deactivated: false
        }
      }
    );

    if (status.n === 0) {
      logger.child(status).debug("debugging update query");

      throw new Error(
        "Internal server error, failed to update the user hash and undeactivate the user account"
      );
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw ErrorResponse(
        TokenError.EXPIRED_TOKEN_EXCEPTION,
        "Temporary reset password token expired",
        { http_code: 401 }
      );
    } else if (
      err.message === "jwt malformed" ||
      err.message === "invalid signature"
    ) {
      throw ErrorResponse(
        TokenError.INVALID_TOKEN_EXCEPTION,
        "Temporary reset password token is invalid",
        { http_code: 401 }
      );
    }

    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed update user password and undeactivate the user's account"
        );
    }

    throw err;
  }
};

/**
 * This function recieves a temporary json web token of the user's information to verify their account
 *
 * @param verificationToken This is a json web token
 */
export const verifyAccount = async (
  verificationToken: string
): Promise<void> => {
  try {
    const decoedToken = jwt.verify(
      verificationToken,
      TOKEN_SECRET
    ) as DecoedTempToken;

    // updating the user information in the users collection
    const status = await userModel.updateOne(
      {
        email: {
          $options: "i",
          $regex: decoedToken.email
        }
      },
      {
        $set: { verified: true }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        email: decoedToken.email
      });

      logger
        .child(fields)
        .error("database query failed to update user account to verified");
      return;
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      // if a token error occurs we would not care about it
      return;
    } else if (
      err.message === "jwt malformed" ||
      err.message === "invalid signature"
    ) {
      logger
        .child({ error: err })
        .warn("This json web token is not signed by the service secret");
      return;
    }

    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to update users account to be verified");
    }

    throw err;
  }
};

/**
 * This function reactivates the user's account using a temp json web token to
 * authenticate/authorize the user
 *
 * @param reactivationToken The temp reset password token
 */
export const reactivateAccount = async (
  reactivationToken: string
): Promise<void> => {
  try {
    const decoedToken = jwt.verify(
      reactivationToken,
      TOKEN_SECRET
    ) as DecoedTempToken;

    const status = await userModel.updateOne(
      {
        email: {
          $options: "i",
          $regex: decoedToken.email
        }
      },
      {
        $set: { deactivated: false }
      }
    );

    if (status.n === 0) {
      logger
        .child(status)
        .warn("Faild to update the the user account from being deactivated");
      return;
    }
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.message === "jwt malformed") {
      return;
    }

    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to reactivate user account");
    }

    throw err;
  }
};
