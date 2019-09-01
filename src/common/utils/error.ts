export interface ServiceError {
  message: string;
  error_code: string;
  context: { [key: string]: any };
}

export default function ErrorConstructor(
  errorCode: string,
  message: string,
  context?: { [key: string]: any }
): ServiceError {
  return {
    message: message,
    error_code: errorCode,
    context: context || {}
  };
}
