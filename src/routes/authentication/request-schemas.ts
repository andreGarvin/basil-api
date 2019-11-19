import * as joi from "joi";

import { MAX_USERNAME_LENGTH } from "../../config";

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

export const genderSchema = joi
  .string()
  .regex(/male|female|other/)
  .error(([err]) => {
    switch (err.type) {
      case "string.base":
        return {
          message: "must provide a gender",
          path: err.path,
          type: err.type
        };
      default:
        return {
          message: err.message,
          path: err.path,
          type: err.type
        };
    }
  });

export const dispalyNameSchema = joi
  .string()
  .optional()
  .allow("")
  .max(MAX_USERNAME_LENGTH)
  .error(([err]) => {
    switch (err.type) {
      case "string.base":
        return {
          message: "must provide a valid display name",
          path: err.path,
          type: err.type
        };
      case "string.max":
        return {
          message: `display name can not be more then ${MAX_USERNAME_LENGTH} characters`,
          path: err.path,
          type: err.type
        };
      default:
        return {
          message: err.message,
          path: err.path,
          type: err.type
        };
    }
  });

export const usernameSchema = joi
  .string()
  .min(0)
  // matching usernames that have a @ symbol or whitespaces
  .regex(/^((?!@|\s).)*$/)
  .max(MAX_USERNAME_LENGTH)
  .error(([err]) => {
    switch (err.type) {
      case "string.base":
        return {
          message: "username name is not valid",
          path: err.path,
          type: err.type
        };
      case "string.regex.base":
        return {
          message: "username cannot contain a @ symbol or whitespaces",
          path: err.path,
          type: err.type
        };
      case "string.max":
        return {
          message: `username can not be more then ${MAX_USERNAME_LENGTH} characters`,
          path: err.path,
          type: err.type
        };
      default:
        return {
          message: "username name is not valid",
          path: err.path,
          type: err.type
        };
    }
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

  gender: genderSchema,

  username: usernameSchema.required(),

  display_name: dispalyNameSchema,

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

  gender: genderSchema,

  username: usernameSchema.required(),

  display_name: dispalyNameSchema,

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
