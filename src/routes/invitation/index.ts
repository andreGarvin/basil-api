import { URL } from "url";

import * as dateFn from "date-fns";

// modules
import * as registry from "../registry/index";

// utils
import {
  sendEmailTemplate,
  sendBlukEmailTemplate,
  TEMPLATES
} from "../../common/utils/send-email-template";
import ErrorResponse, { ServiceError } from "../../common/utils/error";
import logger from "../../common/logger";

// models
import registryModel from "../registry/models/registry.model";
// import adminMemberModel from "../registry/models/member.model";
import userModel from "../authentication/model";
import invitationModel from "./model";

// types
import {
  Invitation,
  SentInvitationResponse,
  InvitationBatchResponse,
  InvitationUpdate,
  SentBatchInvitationResponse,
  InvitationInfo
} from "./types";
import { PaginationResults } from "../../types";

// error codes
import AuthenticationError from "../authentication/error-codes";
import InvitationError from "./error-codes";

export const SERVICE = process.env.APP_NAME || "pivotlms-api";

class InvitationController {
  private async sendBlukInvitationEmail(
    sender: { name: string; email: string },
    invitations: { email: string; type: string; id: string }[],
    schoolName: string
  ): Promise<void> {
    try {
      const blukEmails = invitations.map(invitation => {
        let subject: string;
        if (invitation.type === "admin") {
          subject = `${sender.name} sent you a admin invitation`;
        } else {
          subject = `${
            sender.name
          } has invited you to join ${schoolName} on pivot`;
        }

        // constructing the invitation link
        const invitationLink = new URL(process.env.HOST);

        /* if the server is runnig on heroku then it will use https instead of http,
          this mostly for not runnig into issue for local development (aka localhost). */
        invitationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
        invitationLink.pathname = `/api/invitation/open/${invitation.id}`;

        const redirectUrl = new URL(process.env.HOST);
        invitationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
        redirectUrl.pathname = "/signup";
        redirectUrl.searchParams.append("email", invitation.email);

        // adding redirect url to the template for account creation
        invitationLink.searchParams.append("redirect_url", redirectUrl.href);

        return {
          body: {
            // formatting the subject of the email
            subject,
            // the email of the person that is being sent the invitation
            to: invitation.email,
            from: process.env.NO_REPLY
          },
          // things that will to be included in the email template
          templateVariables: {
            is_professor: invitation.type === "professor",
            is_admin: invitation.type === "admin",

            // the information about the user who is sending the information
            sender_user_name: sender.name,
            sender_email: sender.email,

            // the school information
            school_name: schoolName,

            // adding to the object for the template veriables
            link: invitationLink.href
          }
        };
      });

      // sending the email invitation and compiling the template specified
      return await sendBlukEmailTemplate(TEMPLATES.INVITATON, blukEmails);
    } catch (err) {
      logger.child({ error: err }).error("Failed to send email invitation");
    }
  }

  private async createInvitation(
    userId: string,
    email: string,
    role: string,
    schoolId: string
  ): Promise<Invitation> {
    try {
      if (userId !== SERVICE) {
        const userAccount = await userModel.findOne({ id: userId });
        if (userAccount === null) {
          logger.child({ user_id: userId }).error("User account was not found");

          throw new Error("User account does not exist");
        }

        if (userAccount.role === "student") {
          throw ErrorResponse(
            InvitationError.INVITATION_PREMISSION_EXCEPTION,
            "You do not have premission to send invitations for other users to join your school",
            400
          );
        } else if (userAccount.role === "professor" && role === "admin") {
          role = "student";
        }
      }

      const registeredSchool = await registryModel.findOne({
        id: schoolId
      });
      if (registeredSchool !== null) {
        logger
          .child({ school_id: schoolId })
          .error(
            "Internal error, Invitation was not created becuase the school was not found"
          );

        throw new Error(
          "Internal error, Invitation was not created becuase the school was not found"
        );
      }

      if (registeredSchool.domain) {
        if (!email.endsWith(registeredSchool.domain)) {
          throw ErrorResponse(
            InvitationError.DOMAIN_EXCEPTION,
            "The user's email has been blocked for not match the same email domain as the school that your account is regiestered under",
            400
          );
        }
      }

      // checking if the account does not exist
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
          400
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
          "This invitation has already been sent",
          400
        );
      }

      // creating the time stamp of when the invite was created
      const createdAt = new Date().toISOString();

      // creating a new record of the invitation that is being sent
      const newInvitation = new invitationModel({
        // the email of the user who is receiving the invite
        email,

        // the person who sent the invite
        from: userId,

        // the role the will inherit when creating their account
        type: role,

        // the time of when the invite was created
        created_at: createdAt,

        // the school code the user is creating the account under
        school_id: schoolId,

        // invitations will expire seven days later at the end of that day
        expires_at: dateFn.endOfDay(dateFn.addDays(createdAt, 7)).toISOString()
      });

      // saving the invitation record and handling expectaion
      await newInvitation.save();

      return newInvitation.toJSON();
    } catch (err) {
      if (err instanceof Error) {
        logger.child({ error: err }).error("Failed to create invitation");
      }

      throw err;
    }
  }

  async getInvitation(invitationId: string): Promise<InvitationInfo> {
    try {
      const invitationDocument = await invitationModel.findOne({
        id: invitationId
      });
      if (invitationDocument === null) {
        throw ErrorResponse(
          InvitationError.INVITATION_NOT_FOUND_EXCEPTION,
          "This invitation does not exist",
          400
        );
      }

      return {
        id: invitationDocument.id,
        type: invitationDocument.type,
        email: invitationDocument.email,
        school_id: invitationDocument.school_id,
        expires_at: invitationDocument.expires_at,
        created_at: invitationDocument.created_at
      };
    } catch (err) {
      if (err instanceof Error) {
        logger
          .child({ error: err })
          .error("Failed to retrieve doucment in the invitations collection");
      }

      throw err;
    }
  }

  async sendInvitation(
    user: string,
    email: string,
    role: string,
    schoolId?: string
  ): Promise<SentInvitationResponse> {
    try {
      // the default arguements for settings for the email template
      const sender = {
        email: process.env.NO_REPLY,
        name: "Pivot"
      };

      if (user !== SERVICE) {
        const senderAccount = await userModel.findOne({ id: user });

        if (senderAccount === null) {
          throw new Error(
            "User account was not found when sending email invitation"
          );
        }

        sender.name = `${senderAccount.first_name} ${senderAccount.last_name}`;
        sender.email = senderAccount.email;

        schoolId = senderAccount.school_id;
      }

      // fetching the school information
      const registeredSchool = await registryModel.findOne({ id: schoolId });
      if (registeredSchool === null) {
        logger
          .child({
            school_id: schoolId
          })
          .error("Provided school id does not exist school id");

        throw new Error(
          "Internal error, Invitation was not created becuase the school was not found"
        );
      }

      // fetching the invitation
      const invitationDocument = await invitationModel.findOne({
        from: user,
        email: {
          $options: "i",
          $regex: email
        }
      });

      let invitation: Invitation;
      // if the invitation was not found then create the invitation
      if (invitationDocument === null) {
        invitation = await this.createInvitation(user, email, role, schoolId);
      } else {
        invitation = invitationDocument.toJSON();
      }

      // sending the email invitation
      let subject: string;
      if (invitation.type === "admin") {
        subject = `${sender.name} sent you a admin invitation`;
      } else {
        subject = `${sender.name} has invited you to join ${
          registeredSchool.name
        } on pivot`;
      }

      // constructing the invitation link
      const invitationLink = new URL(process.env.HOST);

      /* if the server is runnig in a docker container on some cloud service then it will use
        https instead of http, this mostly for not runnig into issue for local development
        (aka localhost). */
      invitationLink.protocol = process.env.IS_DOCKER ? "https" : "http";
      invitationLink.pathname = `/api/invitation/open/${invitation.id}`;

      const redirectUrl = new URL(process.env.HOST);
      redirectUrl.protocol = process.env.IS_DOCKER ? "https" : "http";
      redirectUrl.pathname = "/signup";
      redirectUrl.searchParams.append("email", invitation.email);

      // adding redirect url to the template for account creation
      invitationLink.searchParams.append("redirect_url", redirectUrl.href);

      // sending the email invitation and compiling the template specified
      await sendEmailTemplate(
        TEMPLATES.INVITATON,
        {
          // formatting the subject of the email
          subject,
          // the email of the person that is being sent the invitation
          to: invitation.email,
          from: process.env.NO_REPLY
        },
        // things that will to be included in the email template
        {
          is_professor: invitation.type === "professor",
          is_admin: invitation.type === "admin",

          // the school information
          school_name: registeredSchool.name,

          // the information about the user who is sending the information
          sender_user_name: sender.name,
          sender_email: sender.email,

          // adding to the object for the template veriables
          link: invitationLink.href
        }
      );

      return {
        id: invitation.id,
        type: invitation.type,
        email: invitation.email
      };
    } catch (err) {
      if (err instanceof Error) {
        logger.child({ error: err }).error("Failed to send invitation");
      }

      throw err;
    }
  }

  async deleteInvite(user: string, inviteId: string): Promise<string> {
    try {
      const status = await invitationModel.deleteOne({
        from: user,
        id: inviteId
      });
      if (status.n !== 1) {
        logger.warn("Invitation was not deleted", {
          "invitation.from": user,
          "invitation.id": inviteId
        });
      }

      return inviteId;
    } catch (err) {
      if (err instanceof Error) {
        logger
          .child({ error: err })
          .error(
            "Failed to delete the invitation in the invitations collection"
          );
      }

      throw err;
    }
  }

  async sendBlukInvitation(
    user: string,
    emails: string[],
    role: string,
    schoolId?: string
  ): Promise<SentBatchInvitationResponse[]> {
    try {
      const sender = {
        email: process.env.NO_REPLY,
        name: "Pivot"
      };

      if (user !== SERVICE) {
        const userAccount = await userModel.findOne({ id: user });
        if (userAccount === null) {
          logger.child({ user_id: user }).error("User account was not found");

          throw new Error("User account does not exist");
        }

        sender.name = `${userAccount.first_name} ${userAccount.last_name}`;
        sender.email = userAccount.email;

        schoolId = userAccount.school_id;

        if (userAccount.role === "student") {
          throw ErrorResponse(
            InvitationError.INVITATION_PREMISSION_EXCEPTION,
            "You do not have premission to send invitations for other users to join your school",
            400
          );
        } else if (userAccount.role === "professor" && role === "admin") {
          role = "student";
        }
      }

      const registeredSchool = await registryModel.findOne({ id: schoolId });
      if (registeredSchool === null) {
        logger
          .child({
            school_id: schoolId
          })
          .error("Provided school id does not exist school id");

        throw new Error(
          "Internal error, Invitation was not created becuase the school was not found"
        );
      }

      const invitations: SentBatchInvitationResponse[] = await Promise.all(
        emails
          .map(email => ({ email, type: role }))
          // filering all emails that do not match the schools domain
          .map((invitation: SentBatchInvitationResponse) => {
            if (registeredSchool.domain) {
              invitation.invited = invitation.email.endsWith(
                registeredSchool.domain
              );
            } else {
              invitation.invited = true;
            }

            return invitation;
          })
          // this step is iterating over each invitation to either send or reject the invitation
          .map(async (invitation: SentBatchInvitationResponse) => {
            // checking if the account does not exist
            const account = await userModel.findOne({
              email: {
                $options: "i",
                $regex: invitation.email
              },
              school_id: registeredSchool.id
            });
            if (account) {
              invitation.id = null;
              invitation.invited = false;
              invitation.error = AuthenticationError.ACCOUNT_EXIST_EXCEPTION;

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
              // the reason why the id is null is because the invitation was not create by the user sending the invitation
              invitation.id = null;

              invitation.invited = false;
              invitation.error = AuthenticationError.ACCOUNT_EXIST_EXCEPTION;

              return invitation;
            }

            try {
              // creating the time stamp of when the invite was created
              const createdAt = new Date().toISOString();

              // creating a new record of the invitation that is being sent
              const newInvitation = new invitationModel({
                // the email of the user who is receiving the invite
                email: invitation.email,

                // the person who sent the invite
                from: user,

                // the role the will inherit when creating their account
                type: invitation.type,

                // the time of when the invite was created
                created_at: createdAt,

                // the school code the user is creating the account under
                school_id: registeredSchool.id,

                // invitations will expire seven days later at the end of that day
                expires_at: dateFn
                  .endOfDay(dateFn.addDays(createdAt, 7))
                  .toISOString()
              });

              // saving the invitation record and handling expectaion
              await newInvitation.save();

              invitation.invited = true;
              invitation.id = newInvitation.id;

              return invitation;
            } catch (err) {
              logger
                .child({ error: err })
                .error(
                  "Failed to create and insert invitation in invitation collection"
                );

              throw err;
            }
          })
      );

      // getting only the invited recipients
      const invitedRecipients = invitations
        .filter(invitation => invitation.invited)
        .map(({ email, type, id }) => ({ email, type, id }));

      // sending the email invitation to all invited recipients
      await this.sendBlukInvitationEmail(
        sender,
        invitedRecipients,
        registeredSchool.name
      );

      // if the a bluk of admins was add, then insert them into the registered_admin_members collections
      if (role === "admin") {
        const invitedAdmins = invitedRecipients.map(
          invitedAdmin => invitedAdmin.email
        );

        try {
          await registry.insertAdminMemberBluk(invitedAdmins, schoolId);
        } catch (err) {
          logger
            .child({ error: err })
            .error("Failed to insert admins after sending bulk invitations");

          throw err;
        }
      }

      return invitations;
    } catch (err) {
      if (err instanceof Error) {
        logger
          .child({ error: err })
          .error("Failed to send a email invitations");
      }

      throw err;
    }
  }

  async updateInvitationRole(
    user: string,
    inviteId: string,
    newRole: string
  ): Promise<InvitationUpdate> {
    try {
      const invitation = await invitationModel.findOne({
        from: user,
        id: inviteId
      });
      if (invitation === null) {
        throw ErrorResponse(
          InvitationError.INVITATION_NOT_FOUND_EXCEPTION,
          "This invitation does not exist",
          400
        );
      }

      if (user !== SERVICE) {
        const senderAccount = await userModel.findOne({ id: user });

        if (senderAccount === null) {
          throw new Error(
            "User account was not found when sending email invitation"
          );
        }

        if (senderAccount.role === "professor" && newRole === "admin") {
          throw ErrorResponse(
            InvitationError.INVITATION_TYPE_ASSIGNMENT,
            "You do not have the premission to assign this role to this invitation",
            400
          );
        }
      }

      const status = await invitationModel.updateOne(
        {
          from: user,
          id: inviteId
        },
        {
          $set: { type: newRole }
        }
      );
      if (status.n !== 1) {
        logger.error(
          "Failed to update document in the invitations collection",
          {
            "invitation.from": user,
            "invitation.id": inviteId
          }
        );

        throw new Error("Invitation was not updated");
      }

      return {
        type: newRole,
        id: invitation.id
      };
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Failed to updated the invitation type", err);
      }

      throw err;
    }
  }

  async fetchBatch(
    user: string,
    page: number = 1,
    limit: number = 30,
    search: string = "",
    latest: boolean = true,
    type: string = "student"
  ): Promise<PaginationResults<InvitationBatchResponse>> {
    try {
      const acccount = await userModel.findOne({ id: user });
      if (acccount === null) {
        throw new Error("User does not exist");
      }

      type = type.match(/student|professor|admin/) ? type : "student";

      // creaating a aggregation of the invites created and sent by the user
      const invitations = await invitationModel
        .aggregate([
          {
            $match: { from: user }
          },
          {
            $match: {
              email: {
                $regex: search,
                $options: "i"
              }
            }
          },
          {
            $project: {
              id: 1,
              _id: 0,
              type: 1,
              email: 1,
              expires_at: 1,
              created_at: 1
            }
          },
          {
            $match: { type }
          }
        ])
        .sort({ created_at: latest ? -1 : 1 })
        // limit of the number of docuemnts to return
        .limit(limit)
        // creating a pagination of the return documents
        .skip(page > 0 ? (page - 1) * limit : 0);

      // checking if there is more invitations that have not been collected
      const nextPage = await invitationModel
        .find({
          type,
          from: user,
          // getting the ids of all the collected invitations
          id: {
            $nin: invitations.map(invitation => invitation.id)
          }
        })
        .limit(limit)
        .skip(page + 1 > 0 ? (page + 1 - 1) * limit : 0)
        .cursor()
        .next();

      return {
        page,
        limit,
        search,
        results: invitations,
        next_page: nextPage ? page + 1 : -1
      };
    } catch (err) {
      logger.error(
        "Failed to return a pagination of the user's sent invitations",
        err
      );

      throw err;
    }
  }
}

export default new InvitationController();
