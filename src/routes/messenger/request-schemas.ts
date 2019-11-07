import * as joi from "joi";

// config
import { MIN_CHARACTER_LIMIT } from "../../config";

export const newDirectMessageSchema = joi.object().keys({
  member: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a user",
        type: err.type,
        path: err.path
      };
    })
});

const groupNameSchema = joi
  .string()
  .required()
  .max(20)
  .error(([err]) => {
    switch (err.type) {
      case "string.max":
        return {
          message: "the name can not be longer then 20 characters",
          type: err.type,
          path: err.path
        };
      default:
        return {
          message: "must provide a name",
          type: err.type,
          path: err.path
        };
    }
  });
const groupDescriptionSchema = joi
  .string()
  .optional()
  .max(MIN_CHARACTER_LIMIT)
  .error(([err]) => {
    switch (err.type) {
      case "string.max":
        return {
          message: `the description can not be longer then ${MIN_CHARACTER_LIMIT} characters`,
          type: err.type,
          path: err.path
        };
      default:
        return {
          message: "must provide a valid description",
          type: err.type,
          path: err.path
        };
    }
  });

export const newChannelSchema = joi.object().keys({
  name: groupNameSchema,
  description: groupDescriptionSchema
});

export const newGroupSchema = joi.object().keys({
  name: groupNameSchema,
  description: groupDescriptionSchema,
  is_private: joi
    .boolean()
    .optional()
    .error(([err]) => {
      return {
        type: err.type,
        path: err.path,
        message: "muts be a valid value"
      };
    })
});

export const groupSearchParams = joi.object().keys({
  page: joi.number().optional(),

  limit: joi.number().optional(),

  search: joi
    .string()
    .allow("")
    .optional()
});
