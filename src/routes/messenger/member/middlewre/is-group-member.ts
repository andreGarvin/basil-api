// import * as express from "express";

// // models
// import workspaceMemberModel from "../../../workspace/member/model";
// import groupMemberModel from "../models/group-member";
// import groupModel from "../../models/group";

// // utils
// import ErrorResponse from "../../../../common/utils/error";
// import { GroupError } from "../../error-codes";
// import GroupMemberError from "../error-codes";

// const isGroupMember = async (userId: string, groupId: string) => {
//   const group = await groupModel.findOne({
//     id: groupId
//   });
//   if (group) {
//     throw ErrorResponse(
//       GroupError.GROUP_NOT_FOUND_EXCEPTION,
//       "group does not exist",
//       {
//         http_code: 404
//       }
//     );
//   }

//   if (group.is_channel) {
//     // if the user is a member of the workspace then they are a amember of the channel
//     const memberInfo = await workspaceMemberModel.findOne({
//       user_id: userId,
//       workspace_id: groupId
//     });
//     if (memberInfo === null || memberInfo.removed) {
//       throw ErrorResponse(
//         GroupError.GROUP_NOT_FOUND_EXCEPTION,
//         "group does not exist",
//         {
//           http_code: 404
//         }
//       );
//     }

//     return {
//       is_admin: memberInfo.is_admin,
//       is_creator: group.creator === memberInfo.user_id
//     };
//   }

//   const groupMemberInfo = await groupMemberModel.findOne({
//     user_id: userId,
//     group_id: groupId
//   });
//   if (groupMemberInfo === null || groupMemberInfo.removed) {
//     throw ErrorResponse(
//       GroupError.GROUP_NOT_FOUND_EXCEPTION,
//       "group does not exist",
//       {
//         http_code: 404
//       }
//     );
//   }

//   return {
//     is_admin: groupMemberInfo.is_admin,
//     is_creator: group.creator === groupMemberInfo.user_id
//   };
// };

// export default (isAdmin?: boolean, isCreator?: boolean) => {
//   return (
//     req: express.Request,
//     res: express.Response,
//     next: express.NextFunction
//   ) => {
//     const groupId = req.params.group_id || req.body.group_id;

//     return isGroupMember(req.state.user, groupId)
//       .then(memberInfo => {
//         if (isAdmin && memberInfo.is_admin) {
//           res.status(401).json({
//             error_code: GroupMemberError.GROUP_MEMBER_PREMISSION_EXCEPTION,
//             message: "you are not a admin of this group"
//           });
//         }

//         if (isCreator && memberInfo.is_creator) {
//           res.status(401).json({
//             error_code: GroupMemberError.GROUP_MEMBER_PREMISSION_EXCEPTION,
//             message: "you are not the creator of this group"
//           });
//         }
//       })
//       .catch(next);
//   };
// };
