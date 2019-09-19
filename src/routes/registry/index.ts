// models
import registryModel from "./model";

// utils
import Pagination from "../../common/utils/pagination";
import ErrorResponse from "../../common/utils/error";
import logger from "../../common/logger";

// types
import { RegisteredSchoolInfo } from "./types";
import { PaginationResults } from "../../types";

// error codes
// import AuthenticationError from "../authentication/error-codes";
import RegistryError from "./error-codes";

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
      { id: 1 }
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
    const regexSearch = new RegExp(`^${search}`);

    const query = [
      {
        $match: {
          deactivated: false,
          name: {
            $options: "i",
            $regex: regexSearch
          }
        }
      },
      {
        $project: {
          id: 0,
          __v: 0,
          type: 0,
          domain: 0,
          created_at: 0,
          deactivated: 0,
          license_key: 0
        }
      }
    ];

    // getting the pagination for all the documents in the p_registry collection
    const paginationResult = await Pagination(
      registryModel,
      page,
      limit,
      query
    );

    return {
      limit,
      search,
      result: paginationResult.result,
      next_page: paginationResult.next_page
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
