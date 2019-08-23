import * as joi from "joi";

export const newSchoolInfoSchema = joi.object().keys({
  domain: joi
    .string()
    // regex for checking if the dmoain is a "valid" email domain
    .regex(/@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi)
    .optional()
    .error(([err]) => ({
      message: "the domain must be a valid email domain",
      path: err.path,
      type: err.type
    })),

  name: joi
    .string()
    .required()
    .error(([err]) => ({
      message: "You must provide the name of the school you are registering",
      path: err.path,
      type: err.type
    }))
});

export const addAdminbulkSchema = joi.object().keys({
  school_id: joi.string().required(),

  emails: joi
    .array()
    .items(
      joi
        .string()
        .email()
        .required()
        .error(([err]) => {
          return {
            message: "This is not a valid email",
            path: err.path,
            type: err.type
          };
        })
    )
    .required()
    .error(([err]) => {
      if (err.type === "array.min") {
        return {
          message:
            "You must provide at least 1 admin to add the school to the registry",
          path: err.path,
          type: err.type
        };
      }

      return {
        message: err.message,
        path: err.path,
        type: err.type
      };
    })
    .min(1)
    .max(30)
});

export const registrySearchParams = joi.object().keys({
  page: joi.number().optional(),

  limit: joi.number().optional(),

  search: joi
    .string()
    .allow("")
    .optional()
});
