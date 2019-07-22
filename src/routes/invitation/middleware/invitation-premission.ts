// models
import userModel from "../../authentication/model";

// error codes
import InvitationError from "../error-codes";

export default (req, res, next) => {
  return userModel
    .findOne({ uid: req.state.user })
    .then(user => {
      if (user.role === "student") {
        return res.status(401).json({
          error_code: InvitationError.INVITATION_PREMISSION_EXCEPTION,
          message: "You do not have premission to handle invitations"
        });
      }

      return next();
    })
    .catch(next);
};
