import * as joi from "joi";

export const addMemberBulkSchema = joi.object().keys({
  members: joi
    .array()
    .required()
    .items(
      joi.object().keys({
        email: joi
          .string()
          .email()
          .required()
          .error(([err]) => {
            return {
              message: "must provide a valid email",
              path: err.path,
              type: err.type
            };
          }),
        admin: joi
          .boolean()
          .optional()
          .error(([err]) => {
            return {
              message: "must provide a valid value",
              path: err.path,
              type: err.type
            };
          })
      })
    )
    .max(600)
    .min(1)
});

export const workspaceMemberSearchParams = joi.object().keys({
  page: joi.number().optional(),

  limit: joi.number().optional(),

  search: joi
    .string()
    .allow("")
    .optional()
});

export const updateMemberStatusSchema = joi.object().keys({
  status: joi
    .string()
    .required()
    .regex(/AWAY|BUSY/)
    .error(([err]) => {
      return {
        message: "must provide a valid input for updating member status",
        path: err.path,
        type: err.type
      };
    })
});
