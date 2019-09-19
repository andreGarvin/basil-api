import { URL } from "url";

import * as _ from "lodash";

// models
import userModel from "../../authentication/model";
import workspaceMemberModel from "./model";
import workspaceModel from "../model";

// modules
import * as invitation from "../../invitation/index";

// config
import { NO_REPLY, WEB_APP_HOST } from "../../../config";

// utils
import Pagination from "../../../common/utils/pagination";
import ErrorResponse from "../../../common/utils/error";
import logger from "../../../common/logger";
import {
  sendbulkEmailTemplate,
  TEMPLATES
} from "../../../common/utils/send-email-template";

// error codes
import InvitationError from "../../invitation/error-codes";
import WorkspaceMemberError from "./error-codes";

// types
import { PaginationResults } from "../../../types";
import {
  WorkspaceMemberAggregation,
  bulkMemberPreflightCheck,
  AddedMemberBulkResponse,
  PendingWorkspaceMembers,
  NewMember
} from "./types";

// workspace member activity status
export enum WorkspaceMemberStatus {
  active = "ACTIVE",
  away = "AWAY",
  busy = "BUSY"
}

/**
 * This function to sends a batch of email notifications to new members that have been
 * invited to the workspace
 *
 * @param userId The user id of the workspace
 * @param workspaceId The id of the workspace
 * @param newMembers An array of member who have been added to the workspace
 */
const sendBulkWorkspaceInviteEmailNotification = async (
  userId: string,
  workspaceId: string,
  newMembers: NewMember[]
) => {
  try {
    // getting the workspace admin's public account information
    const user = await userModel.findOne(
      { id: userId },
      {
        email: 1,
        last_name: 1,
        first_name: 1
      }
    );

    // getting the workspace information
    const workspaceInfo = await workspaceModel.findOne(
      { id: workspaceId },
      {
        name: 1,
        type: 1,
        section: 1
      }
    );

    // constructing the url for the workspace
    const workspaceLink = new URL(WEB_APP_HOST);
    workspaceLink.protocol = process.env.IS_DOCKER ? "https" : "http";
    // #TODO: Later add the main general channel id for the workspace
    workspaceLink.pathname = `/messenger/${workspaceId}`;

    // mapping over all the new members and creating contructing object to pass to the sendBlukTemplate function
    const emailTemplateObjects = await Promise.all(
      newMembers.map(async member => {
        // getting user name of the new member
        const account = await userModel.findOne(
          { email: member.email },
          {
            last_name: 1,
            first_name: 1
          }
        );

        return {
          // the body of the email
          body: {
            from: NO_REPLY,
            to: member.email,
            subject: "Pivot workspace invitation"
          },
          // email template variables
          templateVariables: {
            // workspace information
            workspace: {
              type: workspaceInfo.type,
              link: workspaceLink.href,
              name:
                `${workspaceInfo.name}` +
                (workspaceInfo.section
                  ? ` section ${workspaceInfo.section}`
                  : "")
            },
            // the workspace admin information
            admin: {
              name: `${user.first_name} ${user.last_name}`
            },
            // the new worksapce information member
            member: {
              email: member.email,
              is_admin: member.admin,
              has_accunt: account !== null,
              name: account
                ? `${account.first_name} ${account.last_name}`
                : member.email
            }
          }
        };
      })
    );

    // sending a batch of email notifications
    await sendbulkEmailTemplate(
      TEMPLATES.WORKSPACE_INVITATION,
      emailTemplateObjects
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error("Failed to send a bulk workspace invitation notificaiton email");

    throw err;
  }
};

/**
 * This function updates the workspace member's status in the workspace_members collection
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param memberStatus The new status
 */
export const updateMemberStatus = async (
  userId: string,
  workspaceId: string,
  memberStatus: string
) => {
  try {
    // updating the member's status
    const status = await workspaceMemberModel.updateOne(
      {
        user_id: userId,
        workspace_id: workspaceId
      },
      {
        $set: {
          status: memberStatus
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        user_id: userId,
        workspace_id: workspaceId
      });

      logger
        .child(fields)
        .error(
          "Internal server error, failed to update workspace member status"
        );

      throw new Error(
        "Internal server error, failed to update workspace member status"
      );
    }

    return memberStatus;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to update workspace member status");
    }

    throw err;
  }
};

/**
 * This function returns a pagination of all invited workspace members
 *
 * #FYI: invited members are people who do not have a account on the platform
 * and were sent a invitation to create there account under the school.
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param page The page number in the pagination
 * @param limit The number of documents to return in the pagination
 */
export const getInvitedWorkspaceMembers = async (
  workspaceId: string,
  page: number,
  limit: number
): Promise<PaginationResults<PendingWorkspaceMembers>> => {
  try {
    const query = [
      // retrieving all the members of the workspace
      {
        $match: { workspace_id: workspaceId }
      },
      // joining users.id on workspace_members.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "user_id"
        }
      },
      // constructing a new document
      {
        $project: {
          user_id: "$user_id",
          is_admin: "$is_admin",
          joined_at: "$joined_at",
          has_account: {
            $cond: [{ $eq: ["$users", []] }, false, true]
          }
        }
      },
      // matching all members that does not have an account
      {
        $match: {
          has_account: false
        }
      },
      {
        $sort: {
          joined_at: 1
        }
      },
      // constructing a new document
      {
        $project: {
          /* the 'user_id' of the invited member is their email,
        the email acts as a placholder for the user when they
        create there account */
          email: "$user_id",
          is_admin: "$is_admin"
        }
      },
      // removing unwanted fields from the document
      {
        $project: {
          user_id: 0,
          has_account: 0
        }
      }
    ];

    const paginationResult = await Pagination(
      workspaceMemberModel,
      page,
      limit,
      query
    );

    return {
      limit,
      result: paginationResult.result,
      next_page: paginationResult.next_page
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to return aggregation invited workspaces that do not have a account from the workspace_members collection"
        );
    }

    throw err;
  }
};

/**
 * This function returns a pagination of the members in the workspace, but does not preform searching
 * on the workspace_members collection
 *
 * @param userId The user id of the workspace member
 * @param workspaceId The id of the workspace
 * @param page The page number in the pagination
 * @param limit The number of documents to return in the pagination
 */
export const getMembers = async (
  workspaceId: string,
  page: number,
  limit: number
): Promise<PaginationResults<WorkspaceMemberAggregation>> => {
  try {
    // fetching the workspace information
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        creator: 1
      }
    );

    // retrieving all the members of the workspace
    const query = [
      {
        $match: { workspace_id: workspaceId }
      },
      // joining users.id on workspace_members.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "user_id"
        }
      },
      // seperating the 'users' field into sepeate documents
      {
        $unwind: "$users"
      },
      // constructing a new document
      {
        $project: {
          status: "$status",
          removed: "$removed",
          user_id: "$user_id",
          is_admin: "$is_admin",
          email: "$users.email",
          is_active: "$is_active",
          joined_at: "$joined_at",
          photo_url: "$users.photo_url",
          last_active_at: "$last_active_at",
          is_creator: {
            $eq: [workspaceInfo.creator, "$user_id"]
          },
          name: {
            $concat: ["$users.first_name", " ", "$users.last_name"]
          }
        }
      },
      {
        $sort: {
          // removed members of the bottom of the list
          removed: 1,
          // the creator and admin at the top of the list
          is_admin: -1,
          is_creator: -1
        }
      },
      // removing unwanted fields from the document
      {
        $project: {
          __v: 0,
          is_creator: 0
        }
      }
    ];

    const paginationResult = await Pagination(
      workspaceMemberModel,
      page,
      limit,
      query
    );

    return {
      limit,
      result: paginationResult.result,
      next_page: paginationResult.next_page
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to return a aggregation of the workspace_members collection"
        );
    }

    throw err;
  }
};

/**
 * This function searches through the workspace_members collection by the name of a member
 * and returnns a pagination of the workspace members
 *
 * @param userId The user id of the workspace memeber
 * @param workspaceId The id of the workspace
 * @param search The name of a workspace member
 * @param page The page number in the pagination
 * @param limit The number of documents to return in the pagination
 */
export const searchForMembers = async (
  workspaceId: string,
  search: string,
  page?: number,
  limit?: number
): Promise<PaginationResults<WorkspaceMemberAggregation>> => {
  try {
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      { creator: 1 }
    );

    // the regexp of the provided search
    const nameRegexpSearch: RegExp = new RegExp(`^${search}`);

    const query = [
      {
        $match: { workspace_id: workspaceId }
      },
      // joining users.id on workspace_members.user_id
      {
        $lookup: {
          as: "users",
          from: "users",
          foreignField: "id",
          localField: "user_id"
        }
      },
      // seperating the 'users' array into individual documents
      {
        $unwind: "$users"
      },
      // constructing a new document
      {
        $project: {
          status: "$status",
          removed: "$removed",
          user_id: "$user_id",
          is_admin: "$is_admin",
          email: "$users.email",
          is_active: "$is_active",
          joined_at: "$joined_at",
          photo_url: "$users.photo_url",
          last_active_at: "$last_active_at",
          is_creator: {
            $eq: [workspaceInfo.creator, "$user_id"]
          },
          name: {
            $concat: ["$users.first_name", " ", "$users.last_name"]
          }
        }
      },
      // searching the members of the workspace
      {
        $match: {
          name: {
            $options: "i",
            $regex: nameRegexpSearch
          }
        }
      },
      // sorting the search
      {
        $sort: {
          // removed memebrs are at the bottom of the list
          removed: 1,
          // the creator of the workspace and admins are at the top of the list
          is_admin: -1,
          is_creator: -1
        }
      },
      // removing unwanted fields from the document
      {
        $project: {
          _id: 0,
          __v: 0,
          is_creator: 0
        }
      }
    ];

    const paginationResult = await Pagination(
      workspaceMemberModel,
      page,
      limit,
      query,
    );

    return {
      limit,
      search,
      result: paginationResult.result,
      next_page: paginationResult.next_page
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to return a search of the workspace_members collection");
    }

    throw err;
  }
};

/**
 * This function updates the member of the workspace to be removed
 *
 * #FYI: If may wonder why this function also does not delete the invitation
 * that might be tied to the workspace member that is invited. The reason for
 * this is because the non user, who is the recipient of the invitation, could
 * be invited to other workspaces and the invitation may or may not belong to
 * the admin "removing" the non user from the workspace. But also the invitation
 * is invital for the person when creating their account and assigning their
 * account role.
 *
 * #FYI: If you are also wondering why this does not permentally delete the document
 * this is for data persitance and also this document has a one to many relation. This
 * would break the application and all data referencing this document
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param memberUserId The user id of a workspace member
 */
export const removeMember = async (
  userId: string,
  workspaceId: string,
  memberUserId: string
): Promise<void> => {
  try {
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      { creator: 1 }
    );

    // a admin can not remove the creator/owner of the workspace
    if (workspaceInfo.creator === memberUserId) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION,
        "admins can not remove the workspace owner from the workspace",
        {
          http_code: 401
        }
      );
    }

    // a admin can not remove themselves from the workspace
    if (userId === memberUserId) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION,
        "you can not remove themselves from the workspace",
        {
          http_code: 401
        }
      );
    }

    // checking if the member of the workspace exist
    const memberInfo = await workspaceMemberModel.findOne({
      // this us implying the member that is being "removed" is not already a removed member
      removed: false,
      workspace_id: workspaceId,
      user_id: {
        // the user id might be a email of a member who does not have a account
        $options: "i",
        $regex: memberUserId
      }
    });
    if (memberInfo === null) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_NOT_FOUND_EXCEPTION,
        "this workspace member does not exist",
        { http_code: 404 }
      );
    }

    // updating the member to be 'removed' from the workspace
    const status = await workspaceMemberModel.updateOne(
      {
        workspace_id: workspaceId,
        user_id: {
          // the reason for doing a regex match is because the user id might be a email
          $options: "i",
          $regex: memberUserId
        }
      },
      {
        $set: {
          removed: true
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        workspace_id: workspaceId,
        user_id: memberUserId
      });

      logger
        .child(fields)
        .error("Internal server error, Failed to update member to be removed");

      throw new Error(
        "Internal server error, Failed to update member to be removed"
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to update memebr to be removed in the workspace_members collection"
        );
    }

    throw err;
  }
};

/**
 * This function is preforms a bulk insert like action for adding a new members into the workspace_members
 * collection. This also handles adding back, updating 'removed', removed members in the collection and
 * sending invitations to members that doe not have a account to an create account on the platform. Lastly,
 * sending a batch of email notifications to all new members that were added to the workspace
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param newMembers An array of the new members that will be added to the workspace
 */
export const addMemberBulk = async (
  userId: string,
  workspaceId: string,
  newMembers: NewMember[]
): Promise<AddedMemberBulkResponse[]> => {
  try {
    // fetching the workspace information
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        id: 1,
        school_id: 1
      }
    );

    // removing all duplicate emails from the array
    newMembers = _.uniqBy(newMembers, "email");

    /* iterating over all the new members in the array and preforming a pre-flight
      check before inserting/unremoving/inviting any of the member to the
      workspace_members collection */
    let bulkMembersResponse: bulkMemberPreflightCheck[] = await Promise.all(
      newMembers.map(async newMember => {
        try {
          // checking if the new member has a existing account
          const account = await userModel.findOne(
            {
              email: {
                $options: "i",
                $regex: newMember.email
              },
              school_id: workspaceInfo.school_id
            },
            {
              id: 1,
              email: 1
            }
          );
          if (account === null) {
            // if the account does not exist the member will be sent a invitation
            return {
              invited: true,
              email: newMember.email,
              is_admin: newMember.admin
            };
          }

          // checking if the new member being added to the workspace is already a member
          const member = await workspaceMemberModel.findOne({
            user_id: account.id,
            workspace_id: workspaceInfo.id
          });
          if (member) {
            // if the user is still a member of the workspace
            if (!member.removed) {
              return {
                added: false,
                email: newMember.email,
                is_admin: newMember.admin,
                error_code:
                  WorkspaceMemberError.WORKSPACE_MEMBER_EXIST_EXCEPTION
              };
            }

            // if the new member was removed from the workspace, then un-remove the member
            return {
              unremove: true,
              email: newMember.email,
              user_id: member.user_id,
              is_admin: newMember.admin
            };
          }

          // the new member being added
          return {
            added: true,
            user_id: account.id,
            email: newMember.email,
            is_admin: newMember.admin
          };
        } catch (err) {
          throw err;
        }
      })
    );

    // sending invitations to the invited members of the workspace
    const invitedMembers = bulkMembersResponse
      .filter(member => member.invited)
      .map(member => member.email);
    if (invitedMembers.length) {
      const invitations = await invitation.sendbulkInvitation(
        userId,
        invitedMembers,
        invitation.InvitationRoles.STUDENT
      );

      // iteraing the bulk invitation response
      bulkMembersResponse = bulkMembersResponse.map(member => {
        if (member.invited) {
          // getting the bulk invitation  response of that email
          const [invitedMember] = invitations.filter(
            invitatedMember => invitatedMember.email === member.email
          );

          if (
            !invitedMember.inserted &&
            invitedMember.error_code !==
              InvitationError.INVITATION_EXIST_EXCEPTION
          ) {
            member.invited = false;
            member.error_code = invitedMember.error_code;
          } else {
            member.added = true;
          }
        }

        return member;
      });
    }

    // inserting all the new members
    const addMembers = bulkMembersResponse.filter(member => member.added);
    if (addMembers.length) {
      const bulkInsert = addMembers.map(member => ({
        is_admin: member.is_admin,
        workspace_id: workspaceInfo.id,
        user_id: member.user_id || member.email
      }));

      await workspaceMemberModel.insertMany(bulkInsert);

      bulkMembersResponse = bulkMembersResponse.map(member => {
        delete member.user_id;

        return member;
      });
    }

    // gathering all the members that are going  to be unremoved
    const unRemovedMembers = bulkMembersResponse.filter(
      member => member.unremove
    );
    if (unRemovedMembers.length) {
      bulkMembersResponse = await Promise.all(
        unRemovedMembers.map(async member => {
          await workspaceMemberModel.updateOne(
            {
              user_id: member.user_id,
              workspace_id: workspaceInfo.id
            },
            {
              $set: {
                removed: false,
                is_admin: member.is_admin
              }
            }
          );

          delete member.unremove;
          delete member.user_id;

          member.added = true;
          return member;
        })
      );
    }

    // sending a batch of email notifications to the new workspace member
    await sendBulkWorkspaceInviteEmailNotification(
      userId,
      workspaceInfo.id,
      bulkMembersResponse
        .filter(member => member.added)
        .map(member => {
          return {
            email: member.email,
            admin: member.is_admin
          };
        })
    );

    return bulkMembersResponse;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to add bulk of members into the workspace");
    }

    throw err;
  }
};

/**
 * This function returns a aggregation of workspace member information from the
 * workspace_members collection
 *
 * @param userId The user id of the workspace member
 * @param workspaceId The id of the workspace
 * @param memberUserId The user id of a workspace member
 */
export const getMemberInfo = async (
  userId: string,
  workspaceId: string,
  memberUserId: string
): Promise<WorkspaceMemberAggregation> => {
  try {
    // fetching the workspace information
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        creator: 1
      }
    );

    const account = await userModel.findOne(
      {
        id: memberUserId
      },
      {
        id: 1,
        email: 1,
        last_name: 1,
        photo_url: 1,
        first_name: 1
      }
    );
    if (account === null) {
      // if the member of the workspace does not have a account, this could be a invited user of the workspace
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_NOT_FOUND_EXCEPTION,
        "this workspace member does not exist",
        { http_code: 404 }
      );
    }

    // checking if the workspace member exist
    const memberInfo = await workspaceMemberModel.findOne(
      {
        user_id: memberUserId,
        workspace_id: workspaceId
      },
      {
        status: 1,
        removed: 1,
        is_admin: 1,
        joined_at: 1,
        is_active: 1,
        last_active_at: 1
      }
    );
    if (memberInfo === null) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_NOT_FOUND_EXCEPTION,
        "this workspace member does not exist",
        { http_code: 404 }
      );
    }

    return {
      user_id: account.id,
      email: account.email,
      status: memberInfo.status,
      removed: memberInfo.removed,
      photo_url: account.photo_url,
      is_admin: memberInfo.is_admin,
      joined_at: memberInfo.joined_at,
      is_active: memberInfo.is_active,
      last_active_at: memberInfo.last_active_at,
      name: `${account.first_name} ${account.last_name}`,
      is_creator: workspaceInfo.creator === memberInfo.user_id
    };
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to return workspace member information");
    }

    throw err;
  }
};

/**
 * This function updates the admin status of a member in the wokspace
 *
 * @param userId The user id of the workspace admin
 * @param workspaceId The id of the workspace
 * @param memberUserId The user id of a workspace member
 */
export const updateMemberAdminStatus = async (
  userId: string,
  workspaceId: string,
  memberUserId: string
): Promise<boolean> => {
  try {
    // fetching the workspace information
    const workspaceInfo = await workspaceModel.findOne(
      {
        id: workspaceId
      },
      {
        creator: 1
      }
    );

    // checking if the workspace member exist
    const memberInfo = await workspaceMemberModel.findOne({
      removed: false,
      workspace_id: workspaceId,
      // this will also target invited members as well
      user_id: {
        $options: "i",
        $regex: memberUserId
      }
    });
    if (memberInfo === null) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_NOT_FOUND_EXCEPTION,
        "this workspace member does not exist",
        { http_code: 404 }
      );
    }

    // the admin can not change their own the admin permission
    if (userId === memberUserId) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION,
        "you can not change your own admin premissions",
        {
          http_code: 401
        }
      );
    }

    // the admin can not change the admin permission of the workspace owner/creator
    if (workspaceInfo.creator === memberUserId) {
      throw ErrorResponse(
        WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION,
        "admins can not change the workspace owner admin premissions",
        {
          http_code: 401
        }
      );
    }

    // updating the workspace member's admin permission
    const status = await workspaceMemberModel.updateOne(
      {
        workspace_id: workspaceId,
        user_id: {
          $options: "i",
          $regex: memberUserId
        }
      },
      {
        $set: {
          is_admin: !memberInfo.is_admin
        }
      }
    );

    if (status.n === 0) {
      const fields = Object.assign({}, status, {
        user_id: memberUserId,
        workspace_id: workspaceId
      });

      logger
        .child(fields)
        .error("Internal server error, failed to update the user admin status");

      throw new Error(
        "Internal server error, failed to update the user admin status"
      );
    }

    return !memberInfo.is_admin;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to update the admin status of the workspace member");
    }

    throw err;
  }
};
