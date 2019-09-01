import * as crypto from "crypto";
import { URL } from "url";

import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as uuid from "uuid/v4";

// models
import invitationModel from "../invitation/model";
import registryModel from "../registry/model";
import userModel from "./model";

// config
import {
  NO_REPLY,
  TOKEN_SECRET,
  WEB_APP_HOST,
  USER_TOKEN_EXPIRATION,
  TEMP_TOKEN_EXPIRATION
} from "../../config";

// utils
import {
  TEMPLATES,
  sendEmailTemplate
} from "../../common/utils/send-email-template";
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";

// error codes
import RegistryError from "../registry/error-codes";
import AuthenticationError from "./error-codes";
import TokenError from "./token/error-codes";

// types
import { NewUserInfo, AccountCredentials } from "./types";
import { InvitationRoles } from "../invitation";

const AVATAR_PHOTO_URL = "https://www.gravatar.com/avatar";

/**
 * This function checks if the users password is unique
 *
 * @param {string} password a password
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
        _id: 0,
        role: 1,
        hash: 1,
        token: 1,
        verified: 1,
        school_id: 1,
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
        { http_code: 400 }
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

    try {
      // each time a user logs in to their accoun the this field is updated
      await userModel.updateOne(
        { id: account.id },
        {
          $set: {
            last_login_at: new Date().toISOString()
          }
        }
      );
    } catch (err) {
      logger
        .child({ error: err })
        .error(
          "Failed to update user data last_login_at when authenticating a user"
        );
      throw err;
    }

    return {
      role: account.role,
      user_id: account.id,
      token: account.token,
      school_id: account.school_id
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
 * This function creates and inserts a new user account into the users collection
 *
 * @param userInfo The user info provided to create the account
 */
export const createAccount = async (userInfo: NewUserInfo): Promise<void> => {
  try {
    // checking if the school access code is valid
    const school = await registryModel.findOne({
      name: {
        $regex: userInfo.school_name
      }
    });
    if (school === null) {
      throw ErrorResponse(
        RegistryError.SCHOOL_NOT_FOUND_EXCEPTION,
        "The school name that was provided does not exist",
        { http_code: 400 }
      );
    }

    // checking the user account already exist under the same email and school
    const account = await userModel.findOne({
      email: {
        $options: "i",
        $regex: userInfo.email
      },
      school_id: school.id
    });
    if (account !== null) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_EXIST_EXCEPTION,
        "Account already exist",
        { http_code: 400 }
      );
    }

    if (school.domain) {
      if (!userInfo.email.endsWith(school.domain)) {
        throw ErrorResponse(
          RegistryError.DOMAIN_EXCEPTION,
          "The email that you have provided does not match the school domain email",
          { http_code: 400 }
        );
      }
    }

    // checking if the user was sent a invitation
    const invitation = await invitationModel.findOne({
      email: {
        $options: "i",
        $regex: userInfo.email
      },
      school_id: school.id
    });
    if (invitation) {
      // checking if the user role matches the invitation type before inserting in the users collection
      if (userInfo.role !== invitation.type) {
        throw ErrorResponse(
          AuthenticationError.USER_ROLE_EXCEPTION,
          "This role was not assigned to your account",
          { http_code: 400 }
        );
      }
    } else {
      if (userInfo.role === undefined) {
        userInfo.role = InvitationRoles.STUDENT;
      } else if (userInfo.role !== InvitationRoles.STUDENT) {
        throw ErrorResponse(
          AuthenticationError.USER_ROLE_EXCEPTION,
          "The role that was selected was not assigned to your account",
          { http_code: 400 }
        );
      }
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

    // generating a user id
    const userId = uuid(process.env.HOST, uuid.URL)
      .split("-")
      .join("");

    // checking a default profile photo for the user account
    const md5Hash = crypto
      .createHash("md5")
      .update(userInfo.email)
      .digest("hex");

    const avatarPhotoUrl = new URL(AVATAR_PHOTO_URL);
    avatarPhotoUrl.pathname = md5Hash;
    avatarPhotoUrl.searchParams.append("d", "identicon");

    // creating the user token
    const token = jwt.sign(
      {
        user_id: userId,
        school_id: school.id
      },
      TOKEN_SECRET,
      {
        algorithm: "HS256",
        expiresIn: USER_TOKEN_EXPIRATION
      }
    );

    const newUser: any = new userModel({
      token,
      id: userId,
      role: userInfo.role,
      school_id: school.id,
      email: userInfo.email,
      last_name: userInfo.last_name,
      photo_url: avatarPhotoUrl.href,
      first_name: userInfo.first_name,
      // generating a hashed password
      hash: bcrypt.hashSync(userInfo.password, 9)
    });

    try {
      await newUser.save();
    } catch (err) {
      logger
        .child({ error: err })
        .error("Failed save account information to users collection");

      throw err;
    }

    // deleting all invitations that were sent to the user under the email and school_id
    await invitationModel.deleteMany({
      email: {
        $options: "i",
        $regex: newUser.email
      },
      school_id: newUser.school_id
    });

    // sending verification email to the user's inbox in order to verify their email address
    await sendVerificationEmail(newUser.email);
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create user account");
    }

    throw err;
  }
};

// interface for temporary authentication tokens
interface DecoedTempToken {
  email: string;
  school_id: string;
}

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
        },
        school_id: decoedToken.school_id
      },
      {
        $set: { verified: true }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign(status, {
        email: decoedToken.email,
        school_id: decoedToken.school_id
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
 * This function updates the user hash in the users collection
 *
 * @param userId The user if
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
    const account = await userModel.findOne(
      { id: userId },
      { _id: 0, hash: 1 }
    );
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
    const hash = bcrypt.hashSync(newPassword, 9);

    const status = await userModel.updateOne(
      { id: userId },
      { $set: { hash } }
    );
    if (status.n === 0) {
      logger
        .child(status)
        .error(
          "Intsernal server error, failed to update the user hash in the users collection"
        );

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
        },
        school_id: decoedToken.school_id
      },
      { _id: 0, id: 1, hash: 1, deactivated: 1 }
    );
    if (account === null) {
      logger
        .child({ email: decoedToken.email, schooli_id: decoedToken.school_id })
        .error("user account was not found");

      throw ErrorResponse(
        AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION,
        "This account does not exist",
        { http_code: 400 }
      );
    }

    if (!account.deactivated) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_ACTIVATED_EXCEPTION,
        "Account is already activated",
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
    const hash = bcrypt.hashSync(newPassword, 9);

    const status = await userModel.updateOne(
      { id: account.id },
      {
        $set: {
          hash,
          deactivated: false
        }
      }
    );

    if (status.n === 0) {
      logger
        .child(status)
        .error(
          "Internal server error, failed to update the user hash and undeactivate the user account"
        );

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
        },
        school_id: decoedToken.school_id
      },
      {
        $set: { deactivated: false }
      }
    );

    if (status.n === 0) {
      logger
        .child(status)
        .error("Faild to update the the user account from being deactivated");
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
    const verificationTempToken = jwt.sign(
      {
        email: account.email,
        school_id: account.school_id
      },
      TOKEN_SECRET,
      {
        algorithm: "HS256",
        expiresIn: TEMP_TOKEN_EXPIRATION
      }
    );

    // creating a link to the verify api endpoint
    const verificationLink = new URL(process.env.HOST);

    verificationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
    verificationLink.pathname = `/auth/verify/${verificationTempToken}`;

    // sending the template email
    await sendEmailTemplate(
      TEMPLATES.ACCOUNT_VERIFICATION,
      {
        from: NO_REPLY,
        to: account.email,
        subject: "Pivot account verification"
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
      { $set: { deactivated: true } }
    );

    if (status.n === 0) {
      logger
        .child(status)
        .error("Internal server error, failed to deactivate the user account");

      throw new Error(
        "Internal server error, failed to deactivate the user account"
      );
    }

    // creating a temporary reset password/ account reactivation token
    const resetPasswordToken = jwt.sign(
      {
        email: account.email,
        school_id: account.school_id
      },
      TOKEN_SECRET,
      {
        algorithm: "HS256",
        expiresIn: TEMP_TOKEN_EXPIRATION
      }
    );

    // forming link to reset password api endpoint
    const resetPasswordLink = new URL(WEB_APP_HOST);
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
        subject: "Password reset for account on pivot"
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
