// models
import registryModel, { RegistratedSchoolModel } from "./model";

// utils
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";

// types
import { RegisteredSchoolInfo } from "./types";
import { PaginationResults } from "../../types";

// error codes
// import AuthenticationError from "../authentication/error-codes";
import RegistryError from "./error-codes";

export const SERVICE = process.env.APP_NAME || "pivotlms-api";

/**
 * Inserts a new school into the registry collection and adds
 * all the admins into the registry_admin_members collection.
 * As well as sending the admins of the school and invitation
 * to create a account.
 *
 * @param {string} schoolName the name of the school
 * @param {string} domain the school domain email
 */
export async function insert(
  schoolName: string,
  domain?: string
): Promise<string> {
  try {
    // Checking if the school exist in the registry and returning the id of the school
    const registeredSchoolDocument: {
      id: string;
    } = await registryModel.findOne(
      {
        $or: [
          {
            name: {
              $regex: schoolName,
              $options: "i"
            }
          },
          {
            name: {
              $regex: schoolName,
              $options: "i"
            },
            domain
          }
        ]
      },
      { _id: 0, id: 1 }
    );
    if (registeredSchoolDocument) {
      logger
        .child({ school_id: registeredSchoolDocument.id })
        .warn("School exist");

      throw ErrorResponse(
        RegistryError.REGISTRATION_EXIST_EXCEPTION,
        "School already exist in the database registry",
        { http_code: 400 }
      );
    }

    const newRegisteredSchool = new registryModel({
      // the domain email of the school, this optional provided for school creation
      domain,

      // the name of the school
      name: schoolName
    });

    await newRegisteredSchool.save();

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
 * This method searches and returns the schools registered in the database
 *
 * @param search {string} The text search string of the name of the school
 * @param page {number} The page number in the pagintation cursor
 * @param limit {number} The number of documents to return back
 */
export async function searchRegistry(
  search?: string,
  page?: number,
  limit?: number
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
            id: 0,
            _id: 0,
            __v: 0,
            type: 0,
            domain: 0,
            created_at: 0,
            deactivated: 0,
            license_key: 0
          }
        }
      ])
      .limit(limit)
      .skip(page > 0 ? (page - 1) * limit : 0);

    // the number of the nextPage
    let nextPage = -1;
    if (schools.length) {
      // checking if there is more in the pagination cursor
      const isMore: boolean = await registryModel
        .find({
          deactivated: false,
          name: {
            $options: "i",
            $regex: new RegExp(`^${search}`)
          }
        })
        .limit(limit)
        .skip(nextPage > 0 ? (nextPage - 1) * limit : 0)
        .cursor()
        .next();

      nextPage = isMore ? page + 1 : -1;
    }

    return {
      page,
      limit,
      search,
      results: schools,
      next_page: nextPage
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
