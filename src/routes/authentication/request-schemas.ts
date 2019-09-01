import * as joi from "joi";

const emailSchema = joi
  .string()
  .email()
  .required()
  .error(([err]) => {
    return {
      message: "must provide a email",
      path: err.path,
      type: err.type
    };
  });

export const BasicAuthenticationSchema = joi.object().keys({
  email: emailSchema,
  password: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a password",
        path: err.path,
        type: err.type
      };
    })
});

export const updatePasswordSchema = joi.object().keys({
  new_password: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a new password",
        path: err.path,
        type: err.type
      };
    }),
  old_password: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a old password",
        path: err.path,
        type: err.type
      };
    })
});

export const resetPasswordSchema = joi.object().keys({
  new_password: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a new password",
        path: err.path,
        type: err.type
      };
    }),
  tmp_token: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a valid token",
        path: err.path,
        type: err.type
      };
    })
});

export const createAccountSchema = joi.object().keys({
  email: emailSchema,

  role: joi
    .string()
    .regex(/student|professor|admin/)
    .optional()
    .error(([err]) => {
      return {
        message: "must select a valid user role",
        path: err.path,
        type: err.type
      };
    }),

  password: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a password",
        path: err.path,
        type: err.type
      };
    }),

  last_name: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide last name",
        path: err.path,
        type: err.type
      };
    }),

  school_name: joi.string().error(([err]) => {
    return {
      message: "must provide valid school name",
      path: err.path,
      type: err.type
    };
  }),

  first_name: joi
    .string()
    .optional()
    .error(([err]) => {
      return {
        message: "must provide first name",
        path: err.path,
        type: err.type
      };
    })
});

export const emailObjectSchema = joi.object().keys({
  email: emailSchema
});
