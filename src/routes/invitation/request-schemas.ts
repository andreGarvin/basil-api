import * as joi from "joi";

export const emailSchema = joi
  .string()
  .email()
  .required()
  .error(([err]) => {
    return {
      message: "must provide a valid email",
      path: err.path,
      type: err.type
    };
  });

export const typeSchema = joi
  .string()
  .regex(/student|professor|admin/)
  .allow("")
  .optional()
  .error(([err]) => {
    return {
      message: "must provide a valid invitation type",
      path: err.path,
      type: err.type
    };
  });

export const recipientInvitationInfoSchema = joi.object().keys({
  email: emailSchema,
  type: typeSchema
});

export const bulkInvitationSchema = joi.object().keys({
  type: typeSchema,

  emails: joi
    .array()
    .items(emailSchema)
    .max(30)
    .min(1)
    .error(([err]) => {
      if (err.type === "array.includesOne") {
        return err;
      }

      return {
        message:
          "the amount of invitations that were sent is greater then the max amount or is less then what is needed",
        path: err.path,
        type: err.type
      };
    })
});
