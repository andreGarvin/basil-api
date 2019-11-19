// models
import userModel from "../../authentication/model";

// error util
import ErrorResponse from "../../../common/utils/error";

// error codes
import UserError from "../error-codes";

// this middleware handles if the user profile/account exists
const profileExistMiddleware = (req, res, next) => {
  return userModel
    .findOne(
      {
        verified: true,
        suspended: false,
        id: req.params.user_id
      },
      {
        id: 1
      }
    )
    .then(userInfo => {
      if (userInfo === null) {
        throw ErrorResponse(
          UserError.USER_NOT_FOUND_EXCEPTION,
          "this user does not exist",
          { http_code: 404 }
        );
      }

      return next();
    })
    .catch(next);
};

export default profileExistMiddleware;
