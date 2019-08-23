import * as crypto from "crypto";

import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as uuid from "uuid/v4";
import * as faker from "faker";

// models
import invitationModel from "../routes/invitation/model";
import registryModel from "../routes/registry/model";
import userModel from "../routes/user/model";

// types
import { UserAccount, newUserInfo } from "../routes/authentication/types";
import { RegistratedSchool } from "../routes/registry/types";
import { Invitation } from "../routes/invitation/types";

// utils
import logger from "../common/logger";

// insert
export const createSchool = async (): Promise<RegistratedSchool> => {
  try {
    const [name] = faker.company.companyName(0).split(" ");

    const newSchool = new registryModel({
      name: name.toLowerCase(),
      domain: `@${name.toLowerCase()}.edu`
    });

    await newSchool.save();

    return newSchool.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into registries collection"
      );

    throw err;
  }
};

export const createUser = async (userInfo: {
  role: string;
  school_id: string;
}): Promise<UserAccount> => {
  try {
    const schooInfo = await registryModel.findOne({ id: userInfo.school_id });

    const lastName = faker.name.lastName();
    const firstName = faker.name.firstName();
    const email = faker.internet.email(
      firstName,
      lastName,
      schooInfo.domain.slice(1)
    );

    const md5Hash: string = crypto
      .createHash("md5")
      .update(email)
      .digest("hex");

    const userId: string = uuid(process.env.HOST, uuid.URL);

    // creating the user token
    const token: string = jwt.sign(
      {
        user_id: userId,
        school_id: userInfo.school_id
      },
      process.env.JSON_WEB_TOKEN_SECERT,
      {
        algorithm: "HS256",
        expiresIn: "365 days"
      }
    );

    const newUser = new userModel({
      ...userInfo,
      email,
      // generating a random user id
      id: userId,
      token: token,
      verified: true,
      last_name: lastName,
      first_name: firstName,
      // generating a hashed password
      hash: bcrypt.hashSync(faker.internet.password(), 9),
      photo_url: `https://www.gravatar.com/avatar/${md5Hash}?d=identicon`
    });

    await newUser.save();

    return newUser.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into users collection"
      );

    throw err;
  }
};

// find
export const findInvitationById = async (
  invitationId: string
): Promise<Invitation> => {
  try {
    const invitation = await invitationModel.findOne({
      id: invitationId
    });

    return invitation ? invitation.toJSON() : invitation;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from invitations collection"
      );
  }
};

export const findInvitationByEmail = async (
  email: string
): Promise<Invitation> => {
  try {
    const invitation = await invitationModel.findOne({
      email: {
        $options: "i",
        $regex: email
      }
    });

    return invitation ? invitation.toJSON() : invitation;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from users collection"
      );
  }
};

export const findUserByEmail = async (email: string): Promise<UserAccount> => {
  try {
    const user = await userModel.findOne({
      email: {
        $options: "i",
        $regex: email
      }
    });

    return user ? user.toJSON() : user;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from users collection"
      );
  }
};

export const findUserById = async (userId: string): Promise<UserAccount> => {
  try {
    const user = await userModel.findOne({
      id: userId
    });

    return user ? user.toJSON() : user;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from users collection"
      );
  }
};

export const returnInvitationsBySchoolId = async (
  schoolId: string
): Promise<Invitation[]> => {
  try {
    const invitations = await invitationModel.find({
      school_id: schoolId
    });

    return invitations;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from invitations collection"
      );
  }
};

export const findSchoolbyId = async (
  schoolId: string
): Promise<RegistratedSchool> => {
  try {
    const school = await registryModel.findOne({
      id: schoolId
    });

    return school ? school.toJSON() : school;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from registries collection"
      );
  }
};

// updates
interface UpdateUserInfo {
  id?: string;
  hash?: string;
  role?: string;
  token?: string;
  email?: string;
  verified?: boolean;
  last_name?: string;
  photo_url?: string;
  school_id?: string;
  created_at?: string;
  first_name?: string;
  deactivated?: boolean;
  description?: string;
  last_login_at?: string;
  temporary_reset_password_token?: string;
}

export const updateUserInfo = async (
  userId: string,
  userInfo: UpdateUserInfo
): Promise<void> => {
  try {
    await userModel.updateOne({ id: userId }, { $set: userInfo });
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to update document from users collection"
      );

    throw err;
  }
};

interface UpdateSchoolInfo {
  name?: string;
  domain?: string;
  deactived?: boolean;
}

export const updateSchoolInfo = async (
  schoolId: string,
  schoolInfo: UpdateSchoolInfo
) => {
  try {
    await registryModel.updateOne({ id: schoolId }, { $set: schoolInfo });
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to update document from registries collection"
      );

    throw err;
  }
};

// delete
export const deleteInvitationById = async (invitationId: string) => {
  try {
    await invitationModel.deleteOne({ id: invitationId });
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete invitation mock data form invitations collection"
      );

    throw err;
  }
};

export const clearInvitations = async () => {
  try {
    await invitationModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form invitations collection"
      );

    throw err;
  }
};

export const clearRegistry = async () => {
  try {
    await registryModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form registries collection"
      );

    throw err;
  }
};

export const clearUsers = async () => {
  try {
    await userModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form users collection"
      );

    throw err;
  }
};
