import * as joi from "joi";

// error response wrapper
import ErrorResponse from "./error";

// error codes
import { VALIDATION_EXCEPTION } from "../error-codes";

interface ValidationErrorResponse {
  message: string;
  field: string;
  pos?: number;
}

export const joiValidateResponse = (
  errors: joi.ValidationErrorItem[]
): ValidationErrorResponse[] => {
  return errors.map(error => {
    const newError: ValidationErrorResponse = {
      message: error.message,
      field: error.context.key
    };

    if (error.type.includes("array")) {
      newError.pos = parseInt(error.path[1], 10);
      newError.field = error.path[0];
    }

    return newError;
  });
};

// a common validation error response
export const ValidationJsonResponse = (context?: { [key: string]: any }) => {
  return ErrorResponse(
    VALIDATION_EXCEPTION,
    "There seems to be issue with the information provided",
    context
  );
};
