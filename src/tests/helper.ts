import * as crypto from "crypto";

// import * as dateFn from "date-fns";
import * as bcrypt from "bcryptjs";
import * as uuid from "uuid/v4";
import * as faker from "faker";

// config
import {
  // USER_TOKEN_EXPIRATION,
  // MIN_CHARACTER_LIMIT,
  // TOKEN_SECRET,
  // APP_NAME
  HOST
} from "../config";

// models
// import groupMemberModel from "../routes/messenger/member/models/group-member";
// import directMessageModel from "../routes/messenger/models/direct-message";
import blockedUserModel from "../routes/user/models/block-user.model";
import followerModel from "../routes/user/models/followers.model";
// import groupModel from "../routes/messenger/models/group";
import userModel from "../routes/authentication/model";

// modules
import * as token from "../routes/authentication/token";

// utils
import logger from "../common/logger";

// module enums
// import { DEFAULT_MAIN_CHANNEL_NAME } from "../routes/messenger";

// types
// import { Group, DirectMessage } from "../routes/messenger/types";
import { UserAccount } from "../routes/authentication/types";
import { BlockedUser, Follower } from "../routes/user/types";

export interface MockUserInfo {
  email: string;
  gender?: string;
  password?: string;
  username: string;
  display_name?: string;
  date_of_birth: string;
}

// mock data functions
export const createMockUserInfo = (): MockUserInfo => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const DOB = new Date();

  return {
    email: faker.internet.email(),
    date_of_birth: DOB.toISOString(),
    password: faker.internet.password(),
    username: faker.internet.userName(),
    display_name: `${firstName} ${lastName}`
  };
};

export const generateUserEmails = (domain: string, count: number): string[] => {
  const emails: string[] = [];
  for (let i = 0; i < count; i++) {
    emails.push(
      faker.internet.email(
        faker.name.firstName(),
        faker.name.lastName(),
        domain
      )
    );
  }

  return emails;
};

export const generateRandomUserEmails = (count: number): string[] => {
  const randomDomain = faker.internet.domainName();

  const emails: string[] = [];
  for (let i = 0; i < count; i++) {
    emails.push(
      faker.internet.email(
        faker.name.firstName(),
        faker.name.lastName(),
        randomDomain
      )
    );
  }

  return emails;
};

// interface NewGroupInfo {
//   name: string;
//   archived?: boolean;
//   description?: string;
//   is_channel?: boolean;
//   is_private?: boolean;
// }
// export const createMockGroupInfo = (): NewGroupInfo => {
//   const [name] = faker.company.companyName(0).split(" ");
//   const description = faker.lorem
//     .words(MIN_CHARACTER_LIMIT)
//     .slice(0, MIN_CHARACTER_LIMIT);

//   return {
//     description,
//     archived: false,
//     is_private: false,
//     is_channel: false,
//     name: name.toLowerCase()
//   };
// };

// // insert
// export const createGroup = async (
//   userId: string,
//   workspaceId: string,
//   groupInfo: NewGroupInfo
// ): Promise<Group> => {
//   try {
//     const newGroup = new groupModel({
//       creator: userId,
//       name: groupInfo.name,
//       workspace_id: workspaceId,
//       archived: groupInfo.archived,
//       is_channel: groupInfo.is_channel,
//       is_private: groupInfo.is_private,
//       description: groupInfo.description
//     });

//     await newGroup.save();

//     return newGroup.toJSON();
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed insert mock data for into workspaces collection"
//       );

//     throw err;
//   }
// };

interface UserAccountInfo {
  email?: string;
  gender?: string;
  username?: string;
  password?: string;
  is_admin?: boolean;
  suspended?: boolean;
  verified?: boolean;
  deactivated?: boolean;
  display_name?: string;
  date_of_birth?: string;
  is_google_account?: boolean;
}
export const createUser = async (
  userInfo?: UserAccountInfo
): Promise<UserAccount> => {
  try {
    userInfo = userInfo || {};

    const newMockUser = createMockUserInfo();

    newMockUser.email = userInfo.email || newMockUser.email;
    newMockUser.gender = userInfo.gender || newMockUser.gender;
    newMockUser.password = userInfo.password || newMockUser.password;
    newMockUser.username = userInfo.username || newMockUser.username;
    newMockUser.display_name =
      userInfo.display_name || newMockUser.display_name;
    newMockUser.date_of_birth =
      userInfo.date_of_birth || newMockUser.date_of_birth;

    const md5Hash: string = crypto
      .createHash("md5")
      .update(newMockUser.email)
      .digest("hex");

    // generating a random user id
    const userId: string = uuid(HOST, uuid.URL);

    // creating the user token
    const newUserToken = token.createUserToken(
      newMockUser.email,
      userInfo.is_admin
    );

    const newUser = new userModel({
      id: userId,
      token: newUserToken,
      email: newMockUser.email,
      gender: newMockUser.gender,
      is_admin: userInfo.is_admin,
      verified: userInfo.verified,
      username: newMockUser.username,
      deactivated: userInfo.deactivated,
      suspended: userInfo.suspended || false,
      display_name: newMockUser.display_name,
      date_of_birth: newMockUser.date_of_birth,
      is_google_account: userInfo.is_google_account,
      // generating a hashed password
      hash: bcrypt.hashSync(newMockUser.password, 9),
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

export const createUsers = async (
  numberOfUsers: number
): Promise<UserAccount[]> => {
  try {
    const newUsers = [];
    for (let i = 0; i < numberOfUsers; i++) {
      newUsers.push(
        await createUser({
          verified: true
        })
      );
    }

    return newUsers;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed one or more insert mock data for into users collection"
      );

    throw err;
  }
};

export const createFollower = async (
  userId: string,
  profileUserId: string
): Promise<void> => {
  try {
    const newFollower = new followerModel({
      user_id: userId,
      following_user_id: profileUserId
    });

    await newFollower.save();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into followers collection"
      );

    throw err;
  }
};

export const createBlockedUser = async (
  userId: string,
  profileUserId: string
): Promise<void> => {
  try {
    const newBlockedUser = new blockedUserModel({
      user_id: userId,
      blocked_user_id: profileUserId
    });

    await newBlockedUser.save();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into blocked_users collection"
      );

    throw err;
  }
};

// export const createDirectMessage = async (
//   workspaceId: string,
//   members: string[]
// ): Promise<DirectMessage> => {
//   try {
//     const newDirectMessage = new directMessageModel({
//       workspace_id: workspaceId
//     });

//     await newDirectMessage.save();

//     return newDirectMessage.toJSON();
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed insert mock data for into direct_messages collection"
//       );

//     throw err;
//   }
// };

// // find
// export const getMainChannel = async (workspaceId: string): Promise<Group> => {
//   try {
//     const channel = await groupModel.findOne({
//       is_channel: true,
//       workspace_id: workspaceId,
//       name: DEFAULT_MAIN_CHANNEL_NAME
//     });

//     return channel ? channel.toJSON() : channel;
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed to return document from groups collection"
//       );
//   }
// };

// export const findGroupById = async (groupId: string): Promise<Group> => {
//   try {
//     const group = await groupModel.findOne({ id: groupId });

//     return group ? group.toJSON() : group;
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed to return document from direct_messages collection"
//       );
//   }
// };

// export const returnGroupMembersById = async (groupId: string) => {
//   try {
//     return await groupMemberModel.find({
//       chat_id: groupId
//     });
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed to return document from group_members collection"
//       );
//   }
// };

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

export const findBlockedUser = async (
  userId: string,
  profileUserId: string
): Promise<BlockedUser> => {
  try {
    const blockedUser = await blockedUserModel.findOne({
      user_id: userId,
      blocked_user_id: profileUserId
    });

    return blockedUser ? blockedUser.toJSON() : blockedUser;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from blocked_users collection"
      );
  }
};

export const findFollower = async (
  userId: string,
  profileUserId: string
): Promise<Follower> => {
  try {
    const follower = await followerModel.findOne({
      user_id: userId,
      following_user_id: profileUserId
    });

    return follower ? follower.toJSON() : follower;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from followers collection"
      );
  }
};

// export const findDirectMessageById = async (
//   directMessageId: string
// ): Promise<DirectMessage> => {
//   try {
//     const directMessage = await directMessageModel.findOne({
//       id: directMessageId
//     });

//     return directMessage ? directMessage.toJSON() : directMessage;
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed to return document from direct_messages collection"
//       );
//   }
// };

// export const findUserById = async (userId: string): Promise<UserAccount> => {
//   try {
//     const user = await userModel.findOne({
//       id: userId
//     });

//     return user ? user.toJSON() : user;
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed to return document from users collection"
//       );
//   }
// };

// updates
interface UpdateUserInfo {
  email?: string;
  hash?: string;
  token?: string;
  gender?: string;
  username?: string;
  password?: string;
  photo_url?: string;
  is_admin?: boolean;
  verified?: boolean;
  created_at?: string;
  description?: string;
  display_name?: string;
  deactivated?: boolean;
  date_of_birth?: string;
  last_login_at?: string;
  is_google_account?: boolean;
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

// // delete
// export const clearGroups = async () => {
//   try {
//     await groupModel.deleteMany({});
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed delete groups mock data form groups collection"
//       );

//     throw err;
//   }
// };

// export const clearDirectMessages = async () => {
//   try {
//     await directMessageModel.deleteMany({});
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed delete direct messages mock data form direct_messages collection"
//       );

//     throw err;
//   }
// };

// export const clearGroupMembers = async () => {
//   try {
//     await groupMemberModel.deleteMany({});
//   } catch (err) {
//     logger
//       .child({ error: err })
//       .error(
//         "Test helper function failed delete all mock data form groups_members collection"
//       );

//     throw err;
//   }
// };

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

export const clearFollowers = async () => {
  try {
    await followerModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form followers collection"
      );

    throw err;
  }
};

export const clearBlockedUsers = async () => {
  try {
    await blockedUserModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form blocked_users collection"
      );

    throw err;
  }
};
