import * as path from "path";

import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";

// database helper functions
import * as db from "../../helper";

interface Context {
  user: {
    professor: {
      id: string;
      token: string;
    };
    student: {
      id: string;
      token: string;
    };
  };
  workspace: {
    id: string;
    school_id: string;
  };
}

const test = ava as TestInterface<Context>;

// error codes
import WorkspaceMemberError from "../../../routes/workspace/member/error-codes";
import WorkspaceError from "../../../routes/workspace/error-codes";

// types
import { InvitationRoles } from "../../../routes/invitation";
import { WorkspaceScopes } from "../../../routes/workspace";

import app from "../../../index";
import WorkspaceMemberRequestError from "../../../routes/workspace/request/error-codes";

// before each test create user, school and pass the context to the all the test of the user and the school
test.beforeEach(async t => {
  // generated a new random school
  const generatedSchool = await db.createSchool();

  const mockUser = db.createMockUserInfo(
    generatedSchool.name,
    generatedSchool.domain,
    InvitationRoles.PROFESSOR
  );

  const professorAccount = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      school_id: generatedSchool.id
    })
  );

  const studentAccount = await db.createUser({
    role: InvitationRoles.STUDENT,
    school_id: generatedSchool.id
  });

  const workspaceMock = db.createMockWorkspaceInfo();
  workspaceMock.scope = WorkspaceScopes.public;

  const newWorkspace = await db.createWorkspace(
    professorAccount.id,
    generatedSchool.id,
    workspaceMock
  );

  t.context.user = {
    professor: {
      id: professorAccount.id,
      token: professorAccount.token
    },
    student: {
      id: studentAccount.id,
      token: studentAccount.token
    }
  };

  t.context.workspace = {
    id: newWorkspace.id,
    school_id: generatedSchool.id
  };
});

test.afterEach.always(async () => {
  await db.clearWorkspaceMemberRequests();

  await db.clearWorkspaceMembers();

  await db.clearWorkspaces();

  await db.clearRegistry();

  await db.clearUsers();
});

test("/api/workspace/request/send/:workspace_id", async t => {
  const response = await request(app)
    .post(`/api/workspace/request/send/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  const workspaceMemberRequest = await db.findworkspaceMemberRequest(
    t.context.user.student.id,
    t.context.workspace.id
  );

  t.not(workspaceMemberRequest, null);
});

test("/api/workspace/request/send/:workspace_id (sending a request but the workspace is private)", async t => {
  await db.updateWorkspaceInfo(t.context.workspace.id, {
    scope: WorkspaceScopes.private
  });

  const response = await request(app)
    .post(`/api/workspace/request/send/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/request/send/:workspace_id (sending a request but user is already a member of the workspace)", async t => {
  await db.createWorkspaceMember(
    t.context.user.student.id,
    t.context.workspace.id
  );

  const response = await request(app)
    .post(`/api/workspace/request/send/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_EXIST_EXCEPTION
  );
});

test("/api/workspace/request/send/:workspace_id (sending a request when one already exist)", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  const response = await request(app)
    .post(`/api/workspace/request/send/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(
    response.body.error_code,
    WorkspaceMemberRequestError.WORKSPACE_MEMBER_REQUEST_EXIST_EXECPTION
  );
});

test("/api/workspace/request/accept/:workspace_id/:user_id", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  const response = await request(app)
    .post(
      `/api/workspace/request/accept/${t.context.workspace.id}/${t.context.user.student.id}`
    )
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");
});

test("/api/workspace/request/accept/:workspace_id/:user_id (a student attempting to accept their own request to join the workspace)", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  const response = await request(app)
    .post(
      `/api/workspace/request/accept/${t.context.workspace.id}/${t.context.user.student.id}`
    )
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.NOT_WORKSPACE_MEMBER_EXCEPTION
  );
});

test("/api/workspace/request/accept/:workspace_id/:user_id (a non admin attempting to accept the request to join the workspace)", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  await db.updateWorkspaceMemberInfo(
    t.context.user.professor.id,
    t.context.workspace.id,
    {
      is_admin: false
    }
  );

  const response = await request(app)
    .post(
      `/api/workspace/request/accept/${t.context.workspace.id}/${t.context.user.student.id}`
    )
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
  );
});

test("/api/workspace/request/accept/:workspace_id/:user_id (attempting to accept a request that does not exist)", async t => {
  const response = await request(app)
    .post(
      `/api/workspace/request/accept/${t.context.workspace.id}/${t.context.user.student.id}`
    )
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.is(
    response.body.error_code,
    WorkspaceMemberRequestError.WORKSPACE_MEMBER_REQUEST_NOT_FOUND_EXCEPTION
  );
});

test("/api/workspace/request/delete/:workspace_id", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  const response = await request(app)
    .delete(`/api/workspace/request/delete/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  const workspaceMemberRequest = await db.findworkspaceMemberRequest(
    t.context.user.student.id,
    t.context.workspace.id
  );

  t.is(workspaceMemberRequest, null);
});

test("/api/workspace/request/delete/:workspace_id (providing a invalid workspace id)", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  const response = await request(app)
    .delete(`/api/workspace/request/delete/some-bullshit-workspace-id`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.not(
    await db.findworkspaceMemberRequest(
      t.context.user.student.id,
      t.context.workspace.id
    ),
    null
  );
});

test("/api/workspace/request/reject/:workspace_id/:user_id", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  const response = await request(app)
    .delete(
      `/api/workspace/request/reject/${t.context.workspace.id}/${t.context.user.student.id}`
    )
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  const workspaceMemberRequest = await db.findworkspaceMemberRequest(
    t.context.user.student.id,
    t.context.workspace.id
  );

  t.is(workspaceMemberRequest, null);
});

test("/api/workspace/request/reject/:workspace_id/:user_id (a non admin attempting to reject the request)", async t => {
  await db.createRequest(t.context.user.student.id, t.context.workspace.id);

  await db.updateWorkspaceMemberInfo(
    t.context.user.professor.id,
    t.context.workspace.id,
    {
      is_admin: false
    }
  );

  const response = await request(app)
    .delete(
      `/api/workspace/request/reject/${t.context.workspace.id}/${t.context.user.student.id}`
    )
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  const workspaceMemberRequest = await db.findworkspaceMemberRequest(
    t.context.user.student.id,
    t.context.workspace.id
  );

  t.not(workspaceMemberRequest, null);
});

test("/api/workspace/request/:workspace_id", async t => {
  const newUsers = await Promise.all([
    db.createUser({
      role: InvitationRoles.STUDENT,
      school_id: t.context.workspace.school_id
    }),
    db.createUser({
      role: InvitationRoles.STUDENT,
      school_id: t.context.workspace.school_id
    })
  ]);

  await Promise.all(
    newUsers.map(
      async newUser =>
        await db.createRequest(newUser.id, t.context.workspace.id)
    )
  );

  const response = await request(app)
    .get(`/api/workspace/request/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.is(response.body.next_page, -1);

  t.is(response.body.result.length, 2);

  t.is(response.body.limit, 15);

  t.is(response.body.search, "");

  const nextPage = response.body.next_page;
  const responseTwo = await request(app)
    .get(`/api/workspace/request/${t.context.workspace.id}?page${nextPage}`)
    .set("x-token", `Bearer ${t.context.user.professor.token}`);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return a status code 200");

  t.is(responseTwo.body.next_page, -1);

  t.is(responseTwo.body.result.length, 2);

  t.is(responseTwo.body.limit, 15);

  t.is(responseTwo.body.search, "");
});

test("/api/workspace/request/:workspace_id (a non admin attempting to fetch all request sent to the workspace)", async t => {
  const response = await request(app)
    .get(`/api/workspace/request/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.student.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.NOT_WORKSPACE_MEMBER_EXCEPTION
  );
});
