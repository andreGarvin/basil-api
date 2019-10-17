import * as crypto from "crypto";

import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as dateFn from "date-fns";
import * as uuid from "uuid/v4";
import * as faker from "faker";

// models
import workspaceMemberRequestModel from "../routes/workspace/request/model";
import directMessageModel from "../routes/messenger/models/direct-message";
import workspaceMemberModel from "../routes/workspace/member/model";
import groupMemberModel from "../routes/messenger/member/models/group-member";
import groupModel from "../routes/messenger/models/group";
import invitationModel from "../routes/invitation/model";
import workspaceModel from "../routes/workspace/model";
import userModel from "../routes/authentication/model";
import registryModel from "../routes/registry/model";

// utils
import logger from "../common/logger";

// module enums
import { WorkspaceTypes, WorkspaceScopes } from "../routes/workspace";
import { DEFAULT_MAIN_CHANNEL_NAME } from "../routes/messenger";

// config
import {
  APP_NAME,
  TOKEN_SECRET,
  CHARACTER_LIMIT,
  USER_TOKEN_EXPIRATION
} from "../config";

// types
import { WorkspaceMemberRequest } from "../routes/workspace/request/types";
import { WorkspaceMember } from "../routes/workspace/member/types";
import { Group, DirectMessage } from "../routes/messenger/types";
import { UserAccount } from "../routes/authentication/types";
import { RegistratedSchool } from "../routes/registry/types";
import { Invitation } from "../routes/invitation/types";
import { Workspace } from "../routes/workspace/types";

export interface MockUserInfo {
  school_name: string;
  first_name: string;
  last_name: string;
  password: string;
  email: string;
  role: string;
}

// mock data functions
export const createMockUserInfo = (
  schoolName: string,
  domain: string,
  role?: string
): MockUserInfo => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();

  return {
    email: faker.internet.email(firstName, lastName, domain.slice(1)),
    password: faker.internet.password(),
    school_name: schoolName || uuid(),
    role: role || "student",
    first_name: firstName,
    last_name: lastName
  };
};

export const createMockSchoolInfo = (): { name: string; domain: string } => {
  const [name] = faker.company.companyName(0).split(" ");

  return {
    name: name.toLowerCase(),
    domain: `@${faker.internet.domainName()}`
  };
};

export const createMockWorkspaceInfo = (): NewWorkspaceInfo => {
  const [name] = faker.company.companyName(0).split(" ");
  const section = uuid().slice(0, 5);
  const description = faker.lorem
    .words(CHARACTER_LIMIT)
    .slice(0, CHARACTER_LIMIT);

  return {
    description,
    section: section,
    name: name.toLowerCase(),
    type: WorkspaceTypes.class,
    scope: WorkspaceScopes.private
  };
};

export const generateUserEmails = (domain: string, count: number): string[] => {
  const emails: string[] = [];
  for (let i = 0; i < count; i++) {
    emails.push(
      faker.internet.email(
        faker.name.firstName(),
        faker.name.lastName(),
        domain.slice(1)
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

interface NewGroupInfo {
  name: string;
  archived?: boolean;
  description?: string;
  is_channel?: boolean;
  is_private?: boolean;
}
export const createMockGroupInfo = (): NewGroupInfo => {
  const [name] = faker.company.companyName(0).split(" ");
  const description = faker.lorem
    .words(CHARACTER_LIMIT)
    .slice(0, CHARACTER_LIMIT);

  return {
    description,
    archived: false,
    is_private: false,
    is_channel: false,
    name: name.toLowerCase()
  };
};

// insert
export const createSchool = async (): Promise<RegistratedSchool> => {
  try {
    const [name] = faker.company.companyName(0).split(" ");
    const domain = faker.internet.domainName();

    const newSchool = new registryModel({
      domain: `@${domain}`,
      name: name.toLowerCase()
    });

    await newSchool.save();

    return newSchool.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into p_registry collection"
      );

    throw err;
  }
};

export const createInvitation = async (email, role, schoolId) => {
  try {
    const newInvitation = new invitationModel({
      email,
      type: role,
      from: APP_NAME,
      school_id: schoolId,
      expires_at: dateFn.addDays(new Date(), 7).toISOString()
    });

    await newInvitation.save();

    return newInvitation.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into invitations collection"
      );

    throw err;
  }
};

interface NewWorkspaceInfo {
  name: string;
  type: string;
  scope: string;
  section: string;
  archived?: boolean;
  description: string;
}
export const createWorkspace = async (
  userId: string,
  schoolId: string,
  workspaceInfo: NewWorkspaceInfo
): Promise<Workspace> => {
  try {
    const newWorkspace = new workspaceModel({
      creator: userId,
      school_id: schoolId,
      name: workspaceInfo.name,
      type: workspaceInfo.type,
      scope: workspaceInfo.scope,
      section: workspaceInfo.section,
      archived: workspaceInfo.archived,
      description: workspaceInfo.description
    });

    await newWorkspace.save();

    const newMember = new workspaceMemberModel({
      is_admin: true,
      user_id: userId,
      workspace_id: newWorkspace.id
    });

    await newMember.save();

    const mainWorkspaceChannel = new groupModel({
      creator: userId,
      is_channel: true,
      workspace_id: newWorkspace.id,
      name: DEFAULT_MAIN_CHANNEL_NAME
    });

    mainWorkspaceChannel.save();

    return newWorkspace.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into workspaces collection"
      );

    throw err;
  }
};

export const createGroup = async (
  userId: string,
  workspaceId: string,
  groupInfo: NewGroupInfo
): Promise<Group> => {
  try {
    const newGroup = new groupModel({
      creator: userId,
      name: groupInfo.name,
      workspace_id: workspaceId,
      archived: groupInfo.archived,
      is_channel: groupInfo.is_channel,
      is_private: groupInfo.is_private,
      description: groupInfo.description
    });

    await newGroup.save();

    return newGroup.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into workspaces collection"
      );

    throw err;
  }
};

interface UserAccountInfo {
  role: string;
  email?: string;
  password?: string;
  school_id: string;
  verified?: boolean;
  last_name?: string;
  first_name?: string;
  deactivated?: boolean;
}
export const createUser = async (
  userInfo: UserAccountInfo
): Promise<UserAccount> => {
  try {
    let {
      role,
      email,
      password,
      school_id,
      last_name,
      first_name,
      deactivated,
      verified = true
    } = userInfo;

    const schooInfo = await registryModel.findOne({ id: school_id });

    if (!last_name) {
      last_name = faker.name.lastName();
    }

    if (!first_name) {
      first_name = faker.name.firstName();
    }

    if (!email) {
      email = faker.internet.email(
        first_name,
        last_name,
        schooInfo.domain.slice(1)
      );
    }

    if (!password) {
      password = faker.internet.password();
    }

    const md5Hash: string = crypto
      .createHash("md5")
      .update(email)
      .digest("hex");

    // generating a random user id
    const userId: string = uuid(process.env.HOST, uuid.URL);

    // creating the user token
    const token: string = jwt.sign(
      {
        user_id: userId,
        school_id: school_id
      },
      TOKEN_SECRET,
      {
        algorithm: "HS256",
        expiresIn: USER_TOKEN_EXPIRATION
      }
    );

    const newUser = new userModel({
      role,
      email,
      verified,
      last_name,
      school_id,
      id: userId,
      first_name,
      deactivated,
      token: token,
      // generating a hashed password
      hash: bcrypt.hashSync(password, 9),
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

export const createDirectMessage = async (
  workspaceId: string,
  members: string[]
): Promise<DirectMessage> => {
  try {
    const newDirectMessage = new directMessageModel({
      members,
      workspace_id: workspaceId
    });

    await newDirectMessage.save();

    return newDirectMessage.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into direct_messages collection"
      );

    throw err;
  }
};

interface NewMemberInfo {
  removed?: boolean;
  is_admin?: boolean;
}

export const createWorkspaceMember = async (
  userId: string,
  workspaceId: string,
  newMemberInfo?: NewMemberInfo
): Promise<WorkspaceMember> => {
  try {
    const newWorkspaceMember = new workspaceMemberModel({
      user_id: userId,
      workspace_id: workspaceId,
      removed: newMemberInfo ? newMemberInfo.removed : false,
      is_admin: newMemberInfo ? newMemberInfo.is_admin : false
    });

    await newWorkspaceMember.save();

    return newWorkspaceMember.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into workspace_members collection"
      );

    throw err;
  }
};

export const createRequest = async (userId: string, workspaceId: string) => {
  try {
    const newWorkspaceMemberRequest = new workspaceMemberRequestModel({
      user_id: userId,
      workspace_id: workspaceId
    });

    await newWorkspaceMemberRequest.save();

    return newWorkspaceMemberRequest.toJSON();
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed insert mock data for into workspace_members collection"
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

export const getMainChannel = async (workspaceId: string): Promise<Group> => {
  try {
    const channel = await groupModel.findOne({
      is_channel: true,
      workspace_id: workspaceId,
      name: DEFAULT_MAIN_CHANNEL_NAME
    });

    return channel ? channel.toJSON() : channel;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from groups collection"
      );
  }
};

export const findWorkspaceById = async (
  workspaceId: string
): Promise<Workspace> => {
  try {
    const workspace = await workspaceModel.findOne({ id: workspaceId });

    return workspace ? workspace.toJSON() : workspace;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from workspaces collection"
      );
  }
};

export const findGroupById = async (groupId: string): Promise<Group> => {
  try {
    const group = await groupModel.findOne({ id: groupId });

    return group ? group.toJSON() : group;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from direct_messages collection"
      );
  }
};

export const returnGroupMembersById = async (groupId: string) => {
  try {
    return await groupMemberModel.find({
      chat_id: groupId
    });
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from group_members collection"
      );
  }
};

export const findworkspaceMemberRequest = async (
  userId: string,
  workspaceId: string
): Promise<WorkspaceMemberRequest> => {
  try {
    const workspaceMemberRequest = await workspaceMemberRequestModel.findOne({
      user_id: userId,
      workspace_id: workspaceId
    });

    return workspaceMemberRequest
      ? workspaceMemberRequest.toJSON()
      : workspaceMemberRequest;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from workspaces collection"
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

export const returnWorkspaceMembers = async (
  workspaceId: string
): Promise<WorkspaceMember[]> => {
  try {
    return await workspaceMemberModel.find({
      workspace_id: workspaceId
    });
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from workspace_member collection"
      );
  }
};

export const findWorkspaceMemberByUserId = async (
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember> => {
  try {
    const workspaceMember = await workspaceMemberModel.findOne({
      user_id: userId,
      workspace_id: workspaceId
    });

    return workspaceMember ? workspaceMember.toJSON() : workspaceMember;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from workspace_member collection"
      );
  }
};

export const findDirectMessageById = async (
  directMessageId: string
): Promise<DirectMessage> => {
  try {
    const directMessage = await directMessageModel.findOne({
      id: directMessageId
    });

    return directMessage ? directMessage.toJSON() : directMessage;
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to return document from direct_messages collection"
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
    return await invitationModel.find({
      school_id: schoolId
    });
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
        "Test helper function failed to return document from p_registry collection"
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

export interface UpdateWorkspaceInfo {
  name?: string;
  type?: string;
  scope?: string;
  creator?: string;
  section?: string;
  school_id?: string;
  archived?: boolean;
  created_at?: string;
  description?: string;
}

export const updateWorkspaceInfo = async (
  workspaceId: string,
  workspaceInfo: UpdateWorkspaceInfo
) => {
  try {
    await workspaceModel.updateOne(
      { id: workspaceId },
      { $set: workspaceInfo }
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to update document from workspace collection"
      );

    throw err;
  }
};

interface UpdateWorkspaceMemberInfo {
  status?: string;
  removed?: boolean;
  joined_at?: string;
  is_admin?: boolean;
  is_active?: boolean;
  last_active_at?: string;
}

export const updateWorkspaceMemberInfo = async (
  userId: string,
  workspaceId: string,
  workspaceMemberInfo: UpdateWorkspaceMemberInfo
) => {
  try {
    await workspaceMemberModel.updateOne(
      { user_id: userId, workspace_id: workspaceId },
      { $set: workspaceMemberInfo }
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed to update document from workspace_members collection"
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
        "Test helper function failed to update document from p_registry collection"
      );

    throw err;
  }
};

// delete
export const deleteMemberfromWorkspaceByUserId = async (
  userId: string,
  workspaceId: string
) => {
  try {
    await workspaceMemberModel.deleteOne({
      user_id: userId,
      workspace_id: workspaceId
    });
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete invitation mock data form workspace_members collection"
      );

    throw err;
  }
};

export const clearGroups = async () => {
  try {
    await groupModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete groups mock data form groups collection"
      );

    throw err;
  }
};

export const clearDirectMessages = async () => {
  try {
    await directMessageModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete direct messages mock data form direct_messages collection"
      );

    throw err;
  }
};

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

export const clearGroupMembers = async () => {
  try {
    await groupMemberModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form groups_members collection"
      );

    throw err;
  }
};

export const clearWorkspaces = async () => {
  try {
    await workspaceModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form workspace collection"
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
        "Test helper function failed delete all mock data form p_registry collection"
      );

    throw err;
  }
};

export const clearWorkspaceMembers = async () => {
  try {
    await workspaceMemberModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form workspace_members collection"
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

export const clearWorkspaceMemberRequests = async () => {
  try {
    await workspaceMemberRequestModel.deleteMany({});
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Test helper function failed delete all mock data form workspace_member_requests collection"
      );

    throw err;
  }
};
