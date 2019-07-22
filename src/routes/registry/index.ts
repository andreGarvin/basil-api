import * as crypto from "crypto";

import * as uuidV4 from "uuid/v4";

// modules
import invitation from "../invitation";

// models
import registryModel, { RegistratedSchoolModel } from "./models/registry.model";

// utils
import ErrorResponse from "../../common/utils/error";
// import {
//   sendEmailTemplate,
//   TEMPLATES,
//   NO_REPLY
// } from "../../common/utils/send-email-template";
import logger from "../../common/logger";

// types
import { RegisteredSchoolInfo, AdminMember } from "./types";
import { PaginationResults } from "../../types";

// error codes
import RegistryError from "./error-codes";
import memberModel from "./models/member.model";

export const SERVICE = process.env.APP_NAME || "pivotlms-api";

/**
 * Inserts a new school into the registry collection and adds
 * all the admins into the registry_admin_members collection.
 * As well as sending the admins of the school and invitation
 * to create a account.
 *
 * @param {string} schoolName the name of the school
 * @param {string} domain the school domain email
 * @param {array} admins a array of the the emails for the admins of the school
 */
export async function insert(
  schoolName: string,
  domain?: string,
  admins: string[] = []
): Promise<string> {
  try {
    // Checking if the school exist in the registry
    const registeredSchoolDocument: any = await registryModel.findOne({
      $or: [{ name: schoolName }, { name: schoolName, domain }]
    });
    if (registeredSchoolDocument !== null) {
      throw ErrorResponse(
        RegistryError.REGISTRATION_EXIST_EXCEPTION,
        "School already exist in the database registry",
        400
      );
    }

    // throw new Error("Hello There");

    // checking if the domain was provided
    if (domain) {
      // checking if the domain is not a generic email domain (ex. @gmail.com, @yahoo.com, and etc)
      if (domain.endsWith(".com")) {
        throw ErrorResponse(
          RegistryError.DOMAIN_REGISTRATION_EXCEPTION,
          "The email domain that you have provided is not a private email domain or is open email domain",
          400
        );
      }

      // Filtered list of all the admins that have the same email domain
      const filteredAdminEmails = admins.filter(adminEmail =>
        adminEmail.endsWith(domain)
      );
      if (filteredAdminEmails.length === 0) {
        throw ErrorResponse(
          RegistryError.ADMIN_REGISTRATION_EXCEPTION,
          "It seems like all the admins you are registering for this school did not have a same email domain as the one that was provided",
          400
        );
      }

      admins = filteredAdminEmails;
    }

    // creating a alias name of the school
    const alias = schoolName
      .split(" ")
      .map(word => word[0])
      .join("");

    // generating random id string
    const uuid: string = crypto.randomBytes(4).toString("hex");

    let newRegisteredSchool = new registryModel({
      // the domain email of the school, this optional provided for school creation
      domain,

      // the name of the school
      name: schoolName,

      // creating license key
      license_key: uuidV4(),

      // creating a school id
      id: `${alias}.${uuid}`
    });

    await newRegisteredSchool.save();

    await inviteAdminMembersBluk(admins, newRegisteredSchool.id);

    // await sendEmailTemplate(
    //   TEMPLATES.NEW_SCHOOL_REGISTRED,
    //   // email information
    //   {
    //     from: NO_REPLY,
    //     to: "",
    //     subject: `${newRegisteredSchool.name} has been added to the registry`
    //   },
    //   // email template variables
    //   {
    //     service: process.env.HOST, // which service was the school created under
    //     // All the other school related data
    //     admins: admins,
    //     school_id: newRegisteredSchool.id,
    //     school_name: newRegisteredSchool.name,
    //     school_domain: newRegisteredSchool.domain,
    //     created_at: newRegisteredSchool.created_at
    //   }
    // );

    return newRegisteredSchool.id;
  } catch (err) {
    if (err instanceof Error) {
      logger
        .child({ error: err })
        .error("Failed to insert new school in registry");
    }

    throw err;
  }
}

/**
 * This method searchees and returns the schools registered in the database
 *
 * @param search {string} The text search string of the name of the school
 * @param page {number} The page number in the pagintation cursor
 * @param limit {number} The number of documents to return back
 */
export async function searchRegistry(
  search?: string,
  page: number = 1,
  limit: number = 15
): Promise<PaginationResults<RegisteredSchoolInfo>> {
  try {
    // creating a aggregation on the registry documents
    const schools: RegistratedSchoolModel[] = await registryModel
      .aggregate([
        {
          $match: {
            name: {
              $regex: new RegExp(`^${search}`),
              $options: "i"
            },
            deactivated: false
          }
        },
        {
          $project: {
            _id: 0,
            __v: 0,
            created_at: 0,
            deactivated: 0,
            license_key: 0
          }
        }
      ])
      .limit(limit)
      .skip(page > 0 ? (page - 1) * limit : 0);

    // checking if there is more in the pagination cursor
    const nextPage: boolean = await registryModel
      .find({
        deactivated: false,
        name: {
          $options: "i",
          $regex: new RegExp(`^${search}`)
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
      results: schools,
      next_page: nextPage ? page + 1 : -1
    };
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Failed to fetch pagination of the schools in the database collection"
      );

    throw err;
  }
}

interface InsertedAdminMember {
  user_id: string;
  inserted: boolean;
  error_code?: string;
}
export async function insertAdminMemberBluk(
  admins: string[],
  schoolId: string
): Promise<InsertedAdminMember[]> {
  try {
    return await Promise.all(
      admins.map(async adminEmail => {
        try {
          const adminMemberDocument: AdminMember = await memberModel.findOne({
            email: {
              $options: "i",
              $regex: adminEmail
            }
          });
          if (adminMemberDocument) {
            return {
              inserted: false,
              user_id: adminEmail,
              error_code: RegistryError.ADMIN_MEMBER_EXIST_EXCEPTION
            };
          }

          const newAdminMember = new memberModel({
            user_id: adminEmail,
            school_id: schoolId
          });
          await newAdminMember.save();

          return {
            inserted: true,
            user_id: newAdminMember.user_id
          };
        } catch (err) {
          logger
            .child({ error: err })
            .error(
              "Failed insert admin member in to registry_admin_members collection"
            );

          throw err;
        }
      })
    );
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Failed insert admin members in to registry_admin_members collection"
      );

    throw err;
  }
}

async function inviteAdminMembersBluk(
  adminEmails: string[],
  schoolId: string
): Promise<void> {
  try {
    // sending a bulk invitation to all admins
    try {
      await invitation.sendBlukInvitation(
        SERVICE,
        adminEmails,
        "admin",
        schoolId
      );
    } catch (err) {
      if (err instanceof Error) {
        logger
          .child({ error: err })
          .error(
            "Failed to send invitation batch to admins being added to the school registry"
          );
      }

      throw err;
    }
  } catch (err) {
    logger
      .child({ error: err })
      .error(
        "Failed to insert admin members into registry_admin_members collection and send batch invitation"
      );

    throw err;
  }
}
