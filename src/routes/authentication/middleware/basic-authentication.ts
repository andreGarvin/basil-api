// import * as express from "express";

// import * as joi from "joi";

// // modules
// import authentication from "../index";

// // utils
// import logger from "../../../common/logger";

// // error codes
// import AuthenticationError from "../error-codes";

// export default (
//   req: express.Request,
//   res: express.Response,
//   next: express.NextFunction
// ) => {
//   // extracts the 'authorization' header field from http request headers
//   const AUTHORIZATION: string = req.headers.authorization;

//   if (!AUTHORIZATION) {
//     return next();
//   }

//   const { error } = joi.validate(AUTHORIZATION, joi.string().required());
//   if (error) {
//     return res.status(400).json({
//       message: error.message,
//       code: AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION
//     });
//   }

//   const [AUTHTYPE, AUTHTOKEN] = AUTHORIZATION.split(" ");
//   if (AUTHTYPE !== "Basic") {
//     return res.status(400).json({
//       message: "Not 'Basic' authentication",
//       code: AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION
//     });
//   }

//   // converts from base64 to ascii to get the user email and password
//   const basicAuth: string = Buffer.from(AUTHTOKEN, "base64").toString("ascii");

//   // extracting the user email and password
//   const [email, password]: string[] = basicAuth.split(":");

//   return authentication
//     .authenticate(email, password)
//     .then(user => {
//       const { verified, deactivated } = user;

//       if (verified === false) {
//         return res.status(401).json({
//           code: AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION,
//           message:
//             "This account has not been verified. Check your email to give the account verification link."
//         });
//       }

//       if (deactivated) {
//         return res.status(401).json({
//           code: AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION,
//           message:
//             "Your account has been deactivated, please check your univeristy email to see why."
//         });
//       }

//       // setting the user.id to the req.state.user
//       req.state.user = user.uid;
//       return next();
//     })
//     .catch(err => {
//       if (err instanceof Error) {
//         logger.error("Error on basic authentication middleware");
//       } else {
//         err.http_code = 401;
//       }

//       return next(err);
//     });
// };
