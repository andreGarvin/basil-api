import { URL } from "url";

import * as dateFn from "date-fns";
import * as _ from "lodash";

// models
import workspaceMemberModel from "../workspace/member/model";
import userModel from "../authentication/model";
import registryModel from "../registry/model";
import invitationModel from "./model";

// config
import { APP_NAME, NO_REPLY } from "../../config";

// utils
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";
import {
  sendbulkEmailTemplate,
  sendEmailTemplate,
  TEMPLATES
} from "../../common/utils/send-email-template";

// error codes
import AuthenticationError from "../authentication/error-codes";
import InvitationError from "./error-codes";

// types
import {
  bulkInvitationInsertResponse,
  SentInvitationResponse,
  InvitationInfo,
  Invitation
} from "./types";

export enum InvitationRoles {
  PROFESSOR = "professor",
  STUDENT = "student",
  ADMIN = "admin"
}

// helper fucntion
/**
 * This function wrapper around the function to send template email
 *
 * @param invitation This is the invitation  document record
 * stored in the invitations collection
 */
const sendEmail = async (invitation: Invitation): Promise<void> => {
  // this is the body of the email
  const emailBody = {
    from: NO_REPLY,
    // the email of the recipient
    to: invitation.email,
    subject: "You were invited to pivot!"
  };

  // constructing the invitation link
  const invitationLink = new URL(process.env.HOST);

  /* if the server is running in a docker container then it will use https
    instead of http, this is a assumes this is up on the web service */
  invitationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
  invitationLink.pathname = `/api/invitation/open/${invitation.id}`;

  const registeredSchool = await registryModel.findOne(
    { id: invitation.school_id },
    { name: 1, _id: 0 }
  );
  if (registeredSchool === null) {
    logger.error(
      "Internal server error, school not found when sending invitation email"
    );

    throw new Error(
      "Internal server error, school not found when sending invitation email"
    );
  }

  // if the server create the invitation
  if (invitation.from === APP_NAME) {
    if (invitation.type !== InvitationRoles.ADMIN) {
      logger.error(
        "Internal server error, The service was sending a non admin invitation"
      );
    }

    emailBody.subject = "Pivot Admin invitation";
    await sendEmailTemplate(TEMPLATES.ADMIN_INVITATION, emailBody, {
      link: invitationLink.href,
      school_name: registeredSchool.name
    });

    return;
  }

  const userAccount = await userModel.findOne({
    id: invitation.from,
    school_id: invitation.school_id
  });

  const userName: string = `${userAccount.first_name} ${userAccount.last_name}`;
  if (invitation.type === InvitationRoles.ADMIN) {
    emailBody.subject = `${userName} sent you a admin invitation to join pivot!`;
  } else {
    emailBody.subject = `${userName} has invited you to join pivot!`;
  }

  const variables = {
    is_professor: invitation.type === InvitationRoles.PROFESSOR,

    sender_email: userAccount.email,
    sender_user_name: `${userAccount.first_name} ${userAccount.last_name}`,

    link: invitationLink.href,
    school_name: registeredSchool.name
  };

  await sendEmailTemplate(TEMPLATES.INVITATON, emailBody, variables);
};

/**
 * This function cretaes and inserts a new invitation into
 * the invitations collection
 *
 * @param {string} from This could be a user id or the name of the service
 * @param {string} email The email of recipient recieving the invitation
 * @param {string} role The role the type of invitation the recipient is being sent
 * @param {string} schoolId The id of the school the invitation belongs to
 */
const createInvitation = async (
  from: string,
  email: string,
  role: string,
  schoolId: string
): Promise<Invitation> => {
  try {
    const registeredSchool = await registryModel.findOne({
      id: schoolId
    });
    if (registeredSchool === null) {
      logger
        .child({ school_id: schoolId })
        .error(
          "Internal server error, invitation was not created becuase the school was not found"
        );

      throw new Error(
        "Internal server error, invitation was not created becuase the school was not found"
      );
    }

    if (registeredSchool.domain) {
      if (!email.endsWith(registeredSchool.domain)) {
        throw ErrorResponse(
          InvitationError.DOMAIN_EXCEPTION,
          "The user's email has been blocked for not match the same domain email as the school that your account is regiestered under",
          { http_code: 400 }
        );
      }
    }

    const account = await userModel.findOne({
      email: {
        $options: "i",
        $regex: email
      },
      school_id: schoolId
    });
    if (account) {
      throw ErrorResponse(
        AuthenticationError.ACCOUNT_EXIST_EXCEPTION,
        "This account already exist under this school",
        { http_code: 400 }
      );
    }

    const invitation = await invitationModel.findOne({
      email: {
        $options: "i",
        $regex: email
      },
      school_id: schoolId
    });
    if (invitation) {
      throw ErrorResponse(
        InvitationError.INVITATION_EXIST_EXCEPTION,
        "This invitation exists",
        { http_code: 400 }
      );
    }

    const createdAt = new Date().toISOString();

    const expirationDate = dateFn
      .endOfDay(dateFn.addDays(createdAt, 7))
      .toISOString();

    // creating a new record of the invitation
    const newInvitation = new invitationModel({
      // who created the invitation
      from,

      // the email of the user who is receiving the invite
      email,

      // the id of the school the invitation is under
      school_id: schoolId,

      created_at: createdAt,

      // the type of invitation and role the will inherit when creating their account
      type: role,

      expires_at: expirationDate
    });

    await newInvitation.save();

    return newInvitation.toJSON();
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to create invitation");
    }

    throw err;
  }
};

/**
 * This function preforms a bulk write to the invitations collection and returns a response of that
 * bulk write
 *
 * @param {string} from The user id or the name of service
 * @param {string[]} emails A array of emails
 * @param {string} role The role the type of invitation the recipient is being sent
 * @param {string} schoolId The id of the school the invitation belongs to
 */
export const writebulkInvitation = async (
  from: string,
  emails: string[],
  role: string,
  schoolId: string
): Promise<bulkInvitationInsertResponse[]> => {
  try {
    const registeredSchool = await registryModel.findOne({ id: schoolId });
    if (registeredSchool === null) {
      logger
        .child({
          school_id: schoolId
        })
        .error("Provided school id does not exist school id");

      throw new Error(
        "Internal server error, failed to write bulk invitation because school was not found"
      );
    }

    const invitationBatch = _.uniq(emails)
      .map(email => ({ email, inserted: false }))
      // filering all emails that do not match the schools domain
      .map((invitation: any) => {
        if (registeredSchool.domain) {
          invitation.inserted = invitation.email.endsWith(
            registeredSchool.domain
          );

          if (!invitation.inserted) {
            invitation.error_code = InvitationError.DOMAIN_EXCEPTION;
          }
        } else {
          invitation.inserted = true;
        }

        return invitation;
      });

    // bulk of invitations being created and sent
    return await Promise.all(
      invitationBatch
        // this step is iterating over each invitation to either send or reject the invitation
        .map(async (invitation: bulkInvitationInsertResponse) => {
          if (!invitation.inserted) {
            return invitation;
          }

          const account = await userModel.findOne({
            email: {
              $options: "i",
              $regex: invitation.email
            },
            school_id: registeredSchool.id
          });
          if (account) {
            invitation.inserted = false;
            invitation.error_code = AuthenticationError.ACCOUNT_EXIST_EXCEPTION;

            return invitation;
          }

          // checking if the invitations exist
          const invitationDocument = await invitationModel.findOne({
            email: {
              $options: "i",
              $regex: invitation.email
            },
            school_id: registeredSchool.id
          });
          if (invitationDocument) {
            invitation.inserted = false;
            invitation.error_code = InvitationError.INVITATION_EXIST_EXCEPTION;

            return invitation;
          }

          try {
            const createdAt = new Date().toISOString();

            const exiprationDate = dateFn
              .endOfDay(dateFn.addDays(createdAt, 7))
              .toISOString();

            const newInvitation = new invitationModel({
              from,
              type: role,
              created_at: createdAt,
              email: invitation.email,
              expires_at: exiprationDate,
              school_id: registeredSchool.id
            });

            await newInvitation.save();

            invitation.id = newInvitation.id;

            return invitation;
          } catch (err) {
            // if the invitation is a duplicate
            if (err.stack.includes("duplicate key")) {
              invitation.inserted = false;
              invitation.error_code =
                InvitationError.INVITATION_EXIST_EXCEPTION;

              return invitation;
            }

            logger
              .child({ error: err })
              .error(
                "Failed to create and insert invitation in invitation collection"
              );

            throw err;
          }
        })
    );
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to write a bulk invitation ");
    }

    throw err;
  }
};

/**
 * This method sends a bulk of email invitations and return a response of the invitations
 * that were sent
 *
 * @param {string} userId The user id
 * @param {string[]} emails The array of emails
 * @param {string} role The role the type of invitation the recipient is being sent
 */
export const sendbulkInvitation = async (
  userId: string,
  emails: string[],
  role: string
): Promise<bulkInvitationInsertResponse[]> => {
  try {
    const userAccount = await userModel.findOne({ id: userId });
    if (userAccount === null) {
      logger
        .child({ user_id: userId })
        .error("This user account does not exist found");

      throw new Error(
        "Internal server error, failed to create invitation because user account does not exist"
      );
    }

    if (userAccount.role === InvitationRoles.STUDENT) {
      throw ErrorResponse(
        InvitationError.INVITATION_PREMISSION_EXCEPTION,
        "Premission denied to send invitations for other users to join your school",
        { http_code: 400 }
      );
    }

    if (userAccount.role === InvitationRoles.ADMIN) {
      if (role === InvitationRoles.ADMIN) {
        throw ErrorResponse(
          InvitationError.INVITATION_PREMISSION_EXCEPTION,
          "You do not have premission can not send a admin invitation",
          { http_code: 401 }
        );
      }
    }

    const registeredSchool = await registryModel.findOne(
      { id: userAccount.school_id },
      { name: 1, _id: 0 }
    );

    const bulkInsertedInvitations = await writebulkInvitation(
      userId,
      emails,
      role,
      userAccount.school_id
    );

    // the name of the user who sent the email invitation
    const userName: string = `${userAccount.first_name} ${userAccount.last_name}`;
    const bulkEmailInvitations = bulkInsertedInvitations
      .filter(emailInvitation => emailInvitation.inserted)
      .map((invitation: bulkInvitationInsertResponse) => {
        // email body
        const emailBody = {
          from: NO_REPLY,
          to: invitation.email,
          subject: "You were invited to pivot!"
        };

        if (role === InvitationRoles.ADMIN) {
          emailBody.subject = `${userName} sent you a admin invitation to join pivot!`;
        } else {
          emailBody.subject = `${userName} has invited you to join pivot!`;
        }

        // constructing the invitation link
        const invitationLink = new URL(process.env.HOST);
        invitationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
        invitationLink.pathname = `/api/invitation/open/${invitation.id}`;

        return {
          body: emailBody,
          // things that will to be included in the email template
          templateVariables: {
            is_professor: role === InvitationRoles.PROFESSOR,

            sender_user_name: userName,
            sender_email: userAccount.email,

            link: invitationLink.href,
            school_name: registeredSchool.name
          }
        };
      });

    // sending the email invitation and compiling the template specified
    await sendbulkEmailTemplate(TEMPLATES.INVITATON, bulkEmailInvitations);

    return bulkInsertedInvitations;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to create and send bulk of email invitations");
    }

    throw err;
  }
};

/**
 * This function returns the invitation from the invitations database collection
 *
 * @param invitationId The id of the invitation stored in the invitations collection
 */
export const getInvitationInfo = async (
  invitationId: string
): Promise<InvitationInfo> => {
  try {
    const invitation = await invitationModel.findOne({
      id: invitationId
    });
    if (invitation) {
      return invitation.toJSON();
    }

    throw ErrorResponse(
      InvitationError.INVITATION_NOT_FOUND_EXCEPTION,
      "Invitation does not exist"
    );
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error(
          "Failed to return invitation information from the invitations collection"
        );
    }

    throw err;
  }
};

/**
 * This function creates & sends invitation email
 *
 * @param userId The id of the user who is sending the invitation
 * @param email The email of the recipient of the user who is sending the email
 * @param role The type of invitation being sent and the role the user will inherit when creating a account
 */
export const sendInvitation = async (
  userId: string,
  email: string,
  role: string
): Promise<SentInvitationResponse> => {
  try {
    const userAccount = await userModel.findOne({ id: userId });
    if (userAccount === null) {
      logger
        .child({ user_id: userId })
        .error("This user account does not exist found");

      throw new Error(
        "Internal server error, failed to create invitation because user account does not exist"
      );
    }

    if (userAccount.role === InvitationRoles.STUDENT) {
      throw ErrorResponse(
        InvitationError.INVITATION_PREMISSION_EXCEPTION,
        "You do not have premission to send invitations for other users to join your school",
        { http_code: 400 }
      );
    }

    if (userAccount.role !== InvitationRoles.ADMIN) {
      if (role === InvitationRoles.ADMIN) {
        throw ErrorResponse(
          InvitationError.INVITATION_PREMISSION_EXCEPTION,
          "You do not have premission can not send a admin invitation",
          { http_code: 401 }
        );
      }
    }

    const newInvitation = await createInvitation(
      userAccount.id,
      email,
      role,
      userAccount.school_id
    );

    await sendEmail(newInvitation);

    return {
      id: newInvitation.id,
      type: newInvitation.type,
      email: newInvitation.email
    };
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to send a invitation");
    }

    if (err.code === InvitationError.INVITATION_EXIST_EXCEPTION) {
      err.message = "Invitation already sent";
    }

    throw err;
  }
};

/**
 * This function deletes a invitation a user has sent
 *
 * @param userId The id of a user
 * @param email the email of the recipient that was sent the invitation
 */
export const deleteInvitation = async (
  userId: string,
  email: string
): Promise<void> => {
  try {
    const invitation = await invitationModel.findOne(
      {
        email: {
          $regex: email,
          $options: "i"
        }
      },
      { from: 1, school_id: 1, _id: 0 }
    );
    if (invitation === null) {
      return;
    }

    const userAccount = await userModel.findOne(
      {
        id: userId,
        school_id: invitation.school_id
      },
      { role: 1, _id: 0 }
    );

    // if the user is a admin of the school they can delete the invitation as well
    if (userAccount.role === InvitationRoles.ADMIN) {
      await invitationModel.deleteOne({
        email: {
          $options: "i",
          $regex: email
        },
        school_id: invitation.school_id
      });

      await workspaceMemberModel.deleteMany({
        user_id: {
          $options: "i",
          $regex: email
        }
      });
      return;
    }

    const status = await invitationModel.deleteOne({
      from: userId,
      email: {
        $regex: email,
        $options: "i"
      },
      school_id: invitation.school_id
    });

    if (status.n === 1) {
      // delete all workspace members that has the email as the value 'user_id' field
      await workspaceMemberModel.deleteMany({
        user_id: {
          $options: "i",
          $regex: email
        }
      });
    } else if (status.n === 0) {
      logger
        .child(status)
        .error("Failed to delete invitation from invitations collections");
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.child({ error: err }).error("Failed to send a invitation");
    }

    throw err;
  }
};

/**
 * This function updates the invitation stored in the invitations record
 *
 * @param userId The id of the user
 * @param email the email of the recipient that was sent the invitation
 * @param newRole The new role the user is assigning to the recipient
 */
export const updateInvitation = async (
  userId: string,
  email: string,
  newRole: string
): Promise<void> => {
  try {
    const userAccount = await userModel.findOne(
      { id: userId },
      {
        id: 1,
        role: 1,
        school_id: 1
      }
    );

    if (
      userAccount.role !== InvitationRoles.ADMIN &&
      newRole === InvitationRoles.ADMIN
    ) {
      newRole = InvitationRoles.STUDENT;
    }

    const invitation = await invitationModel.findOne({
      from: userAccount.id,
      school_id: userAccount.school_id,
      email: {
        $options: "i",
        $regex: email
      }
    });
    if (invitation === null) {
      throw ErrorResponse(
        InvitationError.INVITATION_NOT_FOUND_EXCEPTION,
        "This invitation does not exist",
        { http_code: 404 }
      );
    }

    const status = await invitationModel.updateOne(
      {
        from: userId,
        school_id: userAccount.school_id,
        email: {
          $regex: email,
          $options: "i"
        }
      },
      {
        $set: {
          type: newRole,
          last_updated_at: new Date().toISOString()
        }
      }
    );
    if (status.n === 0) {
      logger.error(
        "Internal server error, Failed to update the invitation type in invitations collection"
      );

      throw new Error(
        "Internal server error, Failed to update the invitation type in invitations collection"
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to update invitation in the invitations collection");
    }

    throw err;
  }
};

export const sendbulkAdminInvitations = async (
  emails: string[],
  schoolId: string
): Promise<bulkInvitationInsertResponse[]> => {
  try {
    const registeredSchool = await registryModel.findOne(
      { id: schoolId },
      { name: 1, id: 1, _id: 0 }
    );
    if (registeredSchool === null) {
      logger.error(
        "Internal server error, school was not located in the registries collection"
      );

      throw new Error(
        "Internal server error, school was not located in the registries collection"
      );
    }

    const bulkInsertedInvitations = await writebulkInvitation(
      APP_NAME,
      emails,
      InvitationRoles.ADMIN,
      registeredSchool.id
    );

    const bulkEmailInvitations = bulkInsertedInvitations
      .filter(emailInvitation => emailInvitation.inserted)
      .map((invitation: bulkInvitationInsertResponse) => {
        // email body
        const emailBody = {
          from: NO_REPLY,
          to: invitation.email,
          subject: "You have been sent a admin invitation to join pivot!"
        };

        // constructing the invitation link
        const invitationLink = new URL(process.env.HOST);
        invitationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
        invitationLink.pathname = `/api/invitation/open/${invitation.id}`;

        return {
          body: emailBody,
          // things that will to be included in the email template
          templateVariables: {
            link: invitationLink.href,
            school_name: registeredSchool.name
          }
        };
      });

    // sending the email invitation and compiling the template specified
    await sendbulkEmailTemplate(TEMPLATES.INVITATON, bulkEmailInvitations);

    return bulkInsertedInvitations;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to create and send bulk of email admin invitations");
    }

    throw err;
  }
};
