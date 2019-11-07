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

export const emailObjectSchema = joi.object().keys({
  email: emailSchema
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

  display_name: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide display name",
        path: err.path,
        type: err.type
      };
    }),

  username: joi.string().error(([err]) => {
    return {
      message: "must provide username",
      path: err.path,
      type: err.type
    };
  }),

  gender: joi
    .string()
    .regex(/male|female|other/)
    .optional()
    .error(([err]) => {
      return {
        message: "must provide a gender",
        path: err.path,
        type: err.type
      };
    }),

  date_of_birth: joi
    .date()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a date of birth",
        path: err.path,
        type: err.type
      };
    })
});

export const createAccountWithGoogleSchema = joi.object().keys({
  email: emailSchema,

  display_name: joi
    .string()
    .required()
    .error(([err]) => {
      return {
        message: "must provide display name",
        path: err.path,
        type: err.type
      };
    }),

  username: joi.string().error(([err]) => {
    return {
      message: "must provide username",
      path: err.path,
      type: err.type
    };
  }),

  gender: joi
    .string()
    .regex(/male|female|other/)
    .optional()
    .error(([err]) => {
      return {
        message: "must provide a gender",
        path: err.path,
        type: err.type
      };
    }),

  date_of_birth: joi
    .date()
    .required()
    .error(([err]) => {
      return {
        message: "must provide a date of birth",
        path: err.path,
        type: err.type
      };
    })
});
