import * as joi from "joi";

// config
import { CHARACTER_LIMIT } from "../../config";

export const workspaceSearchParams = joi.object().keys({
  page: joi.number().optional(),

  limit: joi.number().optional(),

  search: joi
    .string()
    .allow("")
    .optional()
});

export const createWorkspaceSchema = joi.object().keys({
  scope: joi
    .string()
    .optional()
    .regex(/private|public/)
    .error(([err]) => {
      return {
        message: "must provide a valid scope for this workspace",
        type: err.type,
        path: err.path
      };
    }),
  description: joi
    .string()
    .optional()
    .max(CHARACTER_LIMIT)
    .min(0)
    .error(([err]) => {
      switch (err.type) {
        case "string.base":
          return {
            message: "this is a invalid workspace description",
            type: err.type,
            path: err.path
          };
        case "string.max":
          return {
            message: `the workspace description greater then ${CHARACTER_LIMIT} characters`,
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: "this is a invalid workspace description",
            type: err.type,
            path: err.path
          };
      }
    }),
  name: joi
    .string()
    .required()
    .max(50)
    .error(([err]) => {
      switch (err.type) {
        case "any.required":
          return {
            message: "must provide a name for the workspace",
            type: err.type,
            path: err.path
          };
        case "string.base":
          return {
            message: "the name of workspace is invalid",
            type: err.type,
            path: err.path
          };
        case "string.max":
          return {
            message:
              "the name of workspace can not be greater then 50 characters",
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: "the name of workspace is invalid",
            type: err.type,
            path: err.path
          };
      }
    }),
  section: joi
    .string()
    .optional()
    .max(10)
    .error(([err]) => {
      switch (err.type) {
        case "string.max":
          return {
            message: "the section character length can not be greater then 10",
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: "must provide a valid section for this workspace",
            type: err.type,
            path: err.path
          };
      }
    }),
  type: joi
    .string()
    .optional()
    .regex(/class|club/)
    .error(([err]) => {
      return {
        message: "must provide a valid type workspasce",
        type: err.type,
        path: err.path
      };
    })
});

export const updateWorkspaceInfoSchema = joi.object().keys({
  scope: joi
    .string()
    .optional()
    .regex(/private|public/)
    .error(([err]) => {
      return {
        message: "must provide a valid scope for this workspace",
        type: err.type,
        path: err.path
      };
    }),
  description: joi
    .string()
    .optional()
    .max(CHARACTER_LIMIT)
    .error(([err]) => {
      switch (err.type) {
        case "string.base":
          return {
            message: "this is a invalid workspace description",
            type: err.type,
            path: err.path
          };
        case "string.max":
          return {
            message: `the workspace description greater then ${CHARACTER_LIMIT} characters`,
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: "this is a invalid workspace description",
            type: err.type,
            path: err.path
          };
      }
    }),
  name: joi
    .string()
    .optional()
    // .max(50)
    .error(([err]) => {
      switch (err.type) {
        case "any.required":
          return {
            message: "must provide a name for the workspace",
            type: err.type,
            path: err.path
          };
        case "string.base":
          return {
            message: "the name of workspace is invalid",
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: "the name of workspace is invalid",
            type: err.type,
            path: err.path
          };
      }
    }),
  section: joi
    .string()
    .optional()
    .max(10)
    .error(([err]) => {
      switch (err.type) {
        case "string.max":
          return {
            message: "the section character length can not be greater then 10",
            type: err.type,
            path: err.path
          };
        default:
          return {
            message: "must provide a valid section for this workspace",
            type: err.type,
            path: err.path
          };
      }
    }),
  type: joi
    .string()
    .optional()
    .regex(/class|club/)
    .error(([err]) => {
      return {
        message: "must provide a valid type workspasce",
        type: err.type,
        path: err.path
      };
    })
});
