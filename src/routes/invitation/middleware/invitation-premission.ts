// models
import userModel from "../../authentication/model";

// error codes
import InvitationError from "../error-codes";

const invitationPremissionMiddleware = (req, res, next) => {
  return userModel
    .findOne({ id: req.state.user })
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

export default invitationPremissionMiddleware;
