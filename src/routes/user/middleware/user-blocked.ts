// models
import blockUserModel from "../models/block-user.model";

// error util
import ErrorResponse from "../../../common/utils/error";

// error codes
import UserError from "../error-codes";

// this middlware handles if the user is blocked by the account
const isBlockedUserMiddleware = (req, res, next) => {
  return blockUserModel
    .findOne({
      user_id: req.params.user_id,
      blocked_user_id: req.state.user
    })
    .then(blockedUser => {
      if (blockedUser) {
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

export default isBlockedUserMiddleware;
