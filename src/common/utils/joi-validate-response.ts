import * as joi from "joi";

interface ValidationErrorResponse {
  message: string;
  field: string;
  pos?: number;
}

export default (
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
