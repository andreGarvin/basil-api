import * as joi from "joi";

// config
import { MIN_CHARACTER_LIMIT } from "../../config";

// joi schemas
import {
  genderSchema,
  usernameSchema,
  dispalyNameSchema
} from "../authentication/request-schemas";

export const userSearchSchema = joi.object().keys({
  page: joi.number().optional(),

  limit: joi.number().optional(),

  search: joi
    .string()
    .allow("")
    .optional()
});

export const updateProfileSchema = joi.object().keys({
  gender: genderSchema,

  username: usernameSchema,

  display_name: dispalyNameSchema,

  description: joi
    .string()
    .optional()
    .allow("")
    .max(MIN_CHARACTER_LIMIT)
    .error(([err]) => {
      switch (err.type) {
        case "string.base":
          return {
            message: "this is a invalid description",
            type: err.type,
            path: err.path
          };
        case "string.max":
          return {
            message: `the bio description can not be greater then ${MIN_CHARACTER_LIMIT} characters`,
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: err.message,
            type: err.type,
            path: err.path
          };
      }
    })
});
