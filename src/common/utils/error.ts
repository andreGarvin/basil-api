export interface ServiceError {
  http_code: number;
  message: string;
  error_code: string;
}

export default function ErrorConstructor(
  errorCode: string,
  message: string,
  httpCode?: number
): ServiceError {
  return {
    message: message,
    http_code: httpCode,
    error_code: errorCode
  };
}
