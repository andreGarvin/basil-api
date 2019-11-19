enum AuthenticationError {
  EXPIRED_RESET_PASSWORD_TOKEN_EXCEPTION = "EXPIRED_RESET_PASSWORD_TOKEN_EXCEPTION",
  INVALID_AUTHORIZATION_TYPE_EXCEPTION = "INVALID_AUTHORIZATION_TYPE_EXCEPTION",
  ACCOUNT_ROLE_PREMISSION_EXCEPTION = "ACCOUNT_ROLE_PREMISSION_EXCEPTION",
  FAILED_AUTHENTICATION_EXCEPTION = "FAILED_AUTHENTICATION_EXCEPTION",
  ACCOUNT_VERIFICATION_EXCEPTION = "ACCOUNT_VERIFICATION_EXCEPTION",
  ACCOUNT_DEACTIVATED_EXCEPTION = "ACCOUNT_DEACTIVATED_EXCEPTION",
  ACCOUNT_NOT_FOUND_EXCEPTION = "ACCOUNT_NOT_FOUND_EXCEPTION",
  ACCOUNT_ACTIVATED_EXCEPTION = "ACCOUNT_ACTIVATED_EXCEPTION",
  ACCOUNT_SUSPENDED_EXCEPTION = "ACCOUNT_SUSPENDED_EXCEPTION",
  UPDATE_PASSWORD_EXCEPTION = "UPDATE_PASSWORD_EXCEPTION",
  UNIQUE_PASSWORD_EXCEPTION = "UNIQUE_PASSWORD_EXCEPTION",
  ACCOUNT_EXIST_EXCEPTION = "ACCOUNT_EXIST_EXCEPTION",
  UNAUTHORIZED_EXCEPTION = "UNAUTHORIZED_EXCEPTION",
  NEW_PASSWORD_EXCEPTION = "NEW_PASSWORD_EXCEPTION",
  USER_ROLE_EXCEPTION = "USER_ROLE_EXCEPTION"
}

export default AuthenticationError;
