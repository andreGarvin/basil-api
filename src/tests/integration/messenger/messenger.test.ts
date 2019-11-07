// import * as dotenv from "dotenv";
// dotenv.config();

import test from "ava";
// import * as request from "supertest";

// // error codes
// import WorkspaceMemberError from "../../../routes/workspace/member/error-codes";
// import AuthenticationError from "../../../routes/authentication/error-codes";
// import WorkspaceError from "../../../routes/workspace/error-codes";
// import {
//   GroupError,
//   DirectMessageError
// } from "../../../routes/messenger/error-codes";

// // database helper functions
// import * as db from "../../helper";

// interface Context {
//   user: {
//     id: string;
//     token: string;
//   };
//   workspace: {
//     id: string;
//     school_id: string;
//   };
// }
// const test = ava as TestInterface<Context>;

// // types
// import { InvitationRoles } from "../../../routes/invitation";

// import app from "../../../index";

// // before each test create user, school and pass the context to the all the test of the user and the school
// test.beforeEach(async t => {
//   // generated a new random school
//   const generatedSchool = await db.createSchool();

//   const mockUser = db.createMockUserInfo(
//     generatedSchool.name,
//     generatedSchool.domain,
//     InvitationRoles.PROFESSOR
//   );

//   const newUser = await db.createUser(
//     Object.assign(mockUser, {
//       verified: true,
//       school_id: generatedSchool.id
//     })
//   );

//   t.context.user = {
//     id: newUser.id,
//     token: newUser.token
//   };

//   const newWorkspace = await db.createWorkspace(
//     newUser.id,
//     generatedSchool.id,
//     db.createMockWorkspaceInfo()
//   );

//   t.context.workspace = {
//     id: newWorkspace.id,
//     school_id: generatedSchool.id
//   };
// });

// test.afterEach.always(async t => {
//   await db.clearWorkspaceMembers();

//   await db.clearDirectMessages();

//   await db.clearInvitations();

//   await db.clearWorkspaces();

//   await db.clearRegistry();

//   await db.clearGroups();

//   await db.clearUsers();
// });

test.skip("skipping messenge test right now", t => {
  t.fail();
});

// test("/api/messenger/channel/create/:workspace_id", async t => {
//   const mockChannel = db.createMockGroupInfo();

//   delete mockChannel.is_private;
//   delete mockChannel.is_channel;
//   delete mockChannel.archived;

//   const response = await request(app)
//     .post(`/api/messenger/channel/create/${t.context.workspace.id}`)
//     .send(mockChannel)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 201, "should return status of 201");

//   const group = await db.findGroupById(response.body.id);

//   t.false(group.is_private);

//   t.is(group.creator, t.context.user.id);

//   t.true(group.is_channel);

//   t.is(group.workspace_id, t.context.workspace.id);
// });

// test("/api/messenger/channel/create/:workspace_id (non admin attempting to create)", async t => {
//   const mockChannel = db.createMockGroupInfo();

//   delete mockChannel.is_private;
//   delete mockChannel.is_channel;
//   delete mockChannel.archived;

//   const newUser = await db.createUser({
//     role: InvitationRoles.STUDENT,
//     school_id: t.context.workspace.school_id
//   });

//   await db.createWorkspaceMember(newUser.id, t.context.workspace.id);

//   const response = await request(app)
//     .post(`/api/messenger/channel/create/${t.context.workspace.id}`)
//     .send(mockChannel)
//     .set("x-token", `Bearer ${newUser.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 401, "should return status of 401");

//   t.is(
//     response.body.error_code,
//     WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
//   );
// });

// test("/api/messenger/channel/create/:workspace_id (a user who is a not a member of the workspace attempting to create a channel)", async t => {
//   const mockChannel = db.createMockGroupInfo();

//   delete mockChannel.is_private;
//   delete mockChannel.is_channel;
//   delete mockChannel.archived;

//   await db.updateWorkspaceMemberInfo(
//     t.context.user.id,
//     t.context.workspace.id,
//     {
//       removed: true
//     }
//   );

//   const response = await request(app)
//     .post(`/api/messenger/channel/create/${t.context.workspace.id}`)
//     .send(mockChannel)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 404, "should return status of 404");

//   t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
// });

// test("/api/messenger/channel/create/:workspace_id (creating a channel that already exist)", async t => {
//   const mockChannel = db.createMockGroupInfo();

//   mockChannel.is_channel = true;
//   mockChannel.is_private = false;

//   mockChannel.name = mockChannel.name.toUpperCase();

//   await db.createGroup(t.context.user.id, t.context.workspace.id, mockChannel);

//   mockChannel.name = mockChannel.name.toLowerCase();
//   delete mockChannel.is_private;
//   delete mockChannel.is_channel;
//   delete mockChannel.archived;

//   const response = await request(app)
//     .post(`/api/messenger/channel/create/${t.context.workspace.id}`)
//     .send(mockChannel)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 400, "should return status of 400");

//   t.is(response.body.error_code, GroupError.GROUP_EXIST_EXCEPTION);
// });

// test("/api/messenger/channel/create/:workspace_id (creating a channel that already exist but is archived)", async t => {
//   const mockChannel = db.createMockGroupInfo();

//   mockChannel.archived = true;
//   mockChannel.is_channel = true;
//   mockChannel.is_private = false;

//   await db.createGroup(t.context.user.id, t.context.workspace.id, mockChannel);

//   delete mockChannel.is_private;
//   delete mockChannel.is_channel;
//   delete mockChannel.archived;

//   const response = await request(app)
//     .post(`/api/messenger/channel/create/${t.context.workspace.id}`)
//     .send(mockChannel)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 400, "should return status of 400");

//   t.is(response.body.error_code, GroupError.GROUP_EXIST_EXCEPTION);
// });

// test("/api/messenger/channel/create/:workspace_id (creating a channel but workspace has been archived)", async t => {
//   await db.updateWorkspaceInfo(t.context.workspace.id, {
//     archived: true
//   });

//   const mockChannel = db.createMockGroupInfo();

//   delete mockChannel.is_private;
//   delete mockChannel.is_channel;
//   delete mockChannel.archived;

//   const response = await request(app)
//     .post(`/api/messenger/channel/create/${t.context.workspace.id}`)
//     .send(mockChannel)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 403, "should return status of 403");

//   t.is(response.body.error_code, WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION);
// });

// test("/api/messenger/direct-message/create/:workspace_id", async t => {
//   const newUser = await db.createUser({
//     role: InvitationRoles.STUDENT,
//     school_id: t.context.workspace.school_id
//   });

//   await db.createWorkspaceMember(newUser.id, t.context.workspace.id);

//   const response = await request(app)
//     .post(`/api/messenger/direct-message/create/${t.context.workspace.id}`)
//     .send({
//       member: newUser.id
//     })
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 201, "should return status of 201");

//   const directMessage = await db.findDirectMessageById(response.body.id);

//   t.is(directMessage.workspace_id, t.context.workspace.id);

//   t.deepEqual(directMessage.members, [t.context.user.id, newUser.id]);
// });

// test("/api/messenger/direct-message/create/:workspace_id (creating a direct message with yourself)", async t => {
//   const response = await request(app)
//     .post(`/api/messenger/direct-message/create/${t.context.workspace.id}`)
//     .send({
//       member: t.context.user.id
//     })
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 201, "should return status of 201");

//   const directMessage = await db.findDirectMessageById(response.body.id);

//   t.deepEqual(directMessage.members, [t.context.user.id]);
// });

// test("/api/messenger/direct-message/create/:workspace_id (creating a direct message but the other user is not a member of the workspace)", async t => {
//   const newUser = await db.createUser({
//     role: InvitationRoles.STUDENT,
//     school_id: t.context.workspace.school_id
//   });

//   const response = await request(app)
//     .post(`/api/messenger/direct-message/create/${t.context.workspace.id}`)
//     .send({
//       member: newUser.id
//     })
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 400, "should return status of 400");

//   t.is(
//     response.body.error_code,
//     WorkspaceMemberError.WORKSPACE_MEMBER_NOT_FOUND_EXCEPTION
//   );
// });

// test("/api/messenger/direct-message/create/:workspace_id (the direct message already exist between the two members)", async t => {
//   const newUser = await db.createUser({
//     role: InvitationRoles.STUDENT,
//     school_id: t.context.workspace.school_id
//   });

//   await db.createWorkspaceMember(newUser.id, t.context.workspace.id);

//   await db.createDirectMessage(t.context.workspace.id, [
//     newUser.id,
//     t.context.user.id
//   ]);

//   const response = await request(app)
//     .post(`/api/messenger/direct-message/create/${t.context.workspace.id}`)
//     .send({
//       member: newUser.id
//     })
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 400, "should return status of 400");

//   t.is(
//     response.body.error_code,
//     DirectMessageError.DIRECT_MESSAGE_EXIST_EXCEPTION
//   );
// });

// test("/api/messenger/group/create/:workspace_id", async t => {
//   const mockGroup = db.createMockGroupInfo();

//   delete mockGroup.is_channel;
//   delete mockGroup.archived;

//   const response = await request(app)
//     .post(`/api/messenger/group/create/${t.context.workspace.id}`)
//     .send({
//       name: mockGroup.name,
//       is_private: mockGroup.is_private,
//       description: mockGroup.description
//     })
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 201, "should return status of 201");
// });

// test("/api/messenger/feeling-lucky/:workspace_id", async t => {
//   const response = await request(app)
//     .get(`/api/messenger/feeling-lucky/${t.context.workspace.id}`)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 200, "should return status of 200");
// });

// test.skip("/api/messenger/search/:workspace_id", async t => {
//   const one = db.createMockGroupInfo();
//   one.name = "group one";
//   one.is_private = true;

//   const two = db.createMockGroupInfo();
//   two.name = "group two";
//   two.is_private = false;

//   const three = db.createMockGroupInfo();
//   three.name = "group three";
//   three.is_private = true;
//   three.archived = true;

//   const [groupOne, groupTwo, groupThree] = await Promise.all([one, two, three]);

//   const response = await request(app)
//     .get(`/api/messenger/search/${t.context.workspace.id}`)
//     .set("x-token", `Bearer ${t.context.user.token}`);

//   t.log(JSON.stringify(response, null, 4));

//   t.is(response.status, 200, "should return status of 200");

//   t.is(response.body.search, "");

//   t.is(response.body.next_page, -1);

//   t.is(response.body.result.length, 3);
// });
