import * as path from "path";

import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";

// database helper functions
import * as db from "../../helper";

// config
import { ValidationJsonResponse } from "../../../config";
const validationJsonResponse = ValidationJsonResponse();

interface Context {
  user: {
    id: string;
    token: string;
    domain: string;
    school_name: string;
  };
  workspace: {
    id: string;
    school_id: string;
  };
}

const test = ava as TestInterface<Context>;

// error codes
import { CSV_FILE_EXCEPTION } from "../../../routes/workspace/member/middleware/csv-workspace-member-parser";
import WorkspaceMemberError from "../../../routes/workspace/member/error-codes";
import InvitationError from "../../../routes/invitation/error-codes";
import WorkspaceError from "../../../routes/workspace/error-codes";
import { FileError } from "../../../common/error-codes";

// types
import { InvitationRoles } from "../../../routes/invitation";

import app from "../../../index";

// before each test create user, school and pass the context to the all the test of the user and the school
test.beforeEach(async t => {
  // generated a new random school
  const generatedSchool = await db.createSchool();

  const mockUser = db.createMockUserInfo(
    generatedSchool.name,
    generatedSchool.domain,
    InvitationRoles.PROFESSOR
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      school_id: generatedSchool.id
    })
  );

  const newWorkspace = await db.createWorkspace(
    newUser.id,
    generatedSchool.id,
    db.createMockWorkspaceInfo()
  );

  t.context.user = {
    id: newUser.id,
    token: newUser.token,
    domain: generatedSchool.domain,
    school_name: generatedSchool.name
  };

  t.context.workspace = {
    id: newWorkspace.id,
    school_id: generatedSchool.id
  };
});

test.afterEach.always(async () => {
  await db.clearWorkspaceMembers();

  await db.clearInvitations();

  await db.clearWorkspaces();

  await db.clearRegistry();

  await db.clearUsers();
});

test("/api/workspace/member/bluk/:workspace_id", async t => {
  const newUser = await db.createUser({
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: [{ admin: true, email: newUser.email }]
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: [{ is_admin: true, email: newUser.email, added: true }]
  });

  const member = await db.findWorkspaceMemberByUserId(
    newUser.id,
    t.context.workspace.id
  );

  t.true(member.is_admin);

  t.false(member.removed);
});

test("/api/workspace/member/bulk/:workspace_id (sending invalid data)", async t => {
  const response = await request(app)
    .post(`/api/workspace/member/bulk/some-bullshit-workspace_id`)
    .send({
      members: [
        {
          is_admin: "true",
          email: "my-cool-email@@foo.com"
        }
      ]
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/api/workspace/member/bulk/:workspace_id (adding a new member to a workspace does not exist)", async t => {
  const generateUserEmails = db.generateUserEmails(t.context.user.domain, 3);

  const response = await request(app)
    .post("/api/workspace/member/bulk/some-workspace-id")
    .send({
      members: generateUserEmails.map(email => ({ admin: true, email }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/member/bulk/:workspace_id (adding a new member to a archived workspace)", async t => {
  await db.updateWorkspaceInfo(t.context.workspace.id, { archived: true });

  const generateUserEmails = db.generateUserEmails(t.context.user.domain, 3);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generateUserEmails.map(email => ({ admin: true, email }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 403, "should return a status code 403");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION);
});

test("/api/workspace/member/bulk/:workspace_id (adding a new member to a workspace but the who is adding the member is not a member of the workspace)", async t => {
  await db.deleteMemberfromWorkspaceByUserId(
    t.context.user.id,
    t.context.workspace.id
  );

  const generateUserEmails = db.generateUserEmails(t.context.user.domain, 200);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generateUserEmails.map(email => ({ admin: true, email }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/member/bulk/:workspace_id (adding a new member to a workspace but the user is a removed member of the workspace)", async t => {
  await db.updateWorkspaceMemberInfo(
    t.context.user.id,
    t.context.workspace.id,
    {
      removed: true
    }
  );

  const [generateUserEmail] = db.generateUserEmails(t.context.user.domain, 1);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: [{ email: generateUserEmail, admin: false }]
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/member/bulk/:workspace_id (adding a new member to a workspace but the user not a admin of the workspace)", async t => {
  await db.updateWorkspaceMemberInfo(
    t.context.user.id,
    t.context.workspace.id,
    {
      is_admin: false
    }
  );

  const generateUserEmails = db.generateUserEmails(t.context.user.domain, 50);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generateUserEmails.map(email => ({ email, admin: true }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
  );
});

test("/api/workspace/member/bulk/:workspace_id (add a new members but they do not have a account)", async t => {
  const generatedUserEmails = db.generateUserEmails(t.context.user.domain, 3);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generatedUserEmails.map(email => ({
        email,
        admin: true
      }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: generatedUserEmails.map(email => ({
      email,
      added: true,
      invited: true,
      is_admin: true
    }))
  });

  const workspaceMembers = await db.returnWorkspaceMembers(
    t.context.workspace.id
  );

  t.is(workspaceMembers.length, 4);

  const workspaceMemberEmail = generatedUserEmails[0];
  const member = await db.findWorkspaceMemberByUserId(
    workspaceMemberEmail,
    t.context.workspace.id
  );

  t.true(member.is_admin);

  t.is(member.user_id, workspaceMemberEmail);

  const invitations = await db.returnInvitationsBySchoolId(
    t.context.workspace.school_id
  );

  t.is(invitations.length, 3);

  const invitation = invitations[0];
  t.is(invitation.from, t.context.user.id);

  t.is(invitation.type, InvitationRoles.STUDENT);
  t.is(invitation.school_id, t.context.workspace.school_id);
});

test("/api/workspace/member/bulk/:workspace_id (duplicate members added)", async t => {
  const [generatedUserEmailOne, generatedUserEmailTwo] = db.generateUserEmails(
    t.context.user.domain,
    2
  );
  const generatedUserEmails = [
    generatedUserEmailOne,
    generatedUserEmailOne,
    generatedUserEmailTwo
  ];

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generatedUserEmails.map(email => ({
        email,
        admin: true
      }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: [generatedUserEmailOne, generatedUserEmailTwo].map(email => ({
      email,
      added: true,
      invited: true,
      is_admin: true
    }))
  });

  const workspaceMembers = await db.returnWorkspaceMembers(
    t.context.workspace.id
  );

  t.is(workspaceMembers.length, 3);
});

test("/api/workspace/member/bulk/:workspace_id (integration test: a user creating their account after being invited to a class but not having a account)", async t => {
  const generatedUserEmails = db.generateUserEmails(t.context.user.domain, 1);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generatedUserEmails.map(email => ({
        email,
        admin: true
      }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: generatedUserEmails.map(email => ({
      email,
      added: true,
      invited: true,
      is_admin: true
    }))
  });

  const mockUser = db.createMockUserInfo(
    t.context.user.school_name,
    t.context.user.domain,
    InvitationRoles.STUDENT
  );

  mockUser.password = "@Foobarba3";
  mockUser.email = generatedUserEmails[0];

  const responseTwo = await request(app)
    .post("/auth/create")
    .send(mockUser);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 201, "Should return status code of 201");

  const account = await db.findUserByEmail(mockUser.email);

  const workspaceMember = await db.findWorkspaceMemberByUserId(
    account.id,
    t.context.workspace.id
  );

  t.true(workspaceMember.is_admin);

  t.is(workspaceMember.user_id, account.id);
});

test("/api/workspace/member/bulk/:workspace_id (integration test: however the email is uppercased)", async t => {
  const generatedUserEmails = db.generateUserEmails(t.context.user.domain, 1);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generatedUserEmails.map(email => ({
        admin: true,
        email: email.split("@")[0].toUpperCase() + "@" + email.split("@")[1]
      }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: generatedUserEmails.map(email => ({
      added: true,
      invited: true,
      is_admin: true,
      email: email.split("@")[0].toUpperCase() + "@" + email.split("@")[1]
    }))
  });

  const mockUser = db.createMockUserInfo(
    t.context.user.school_name,
    t.context.user.domain,
    InvitationRoles.STUDENT
  );

  const userEmail = generatedUserEmails[0];
  mockUser.password = "@Foobarba3";
  mockUser.email =
    userEmail.split("@")[0].toUpperCase() + "@" + userEmail.split("@")[1];

  const responseTwo = await request(app)
    .post("/auth/create")
    .send(mockUser);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 201, "Should return status code of 201");

  const account = await db.findUserByEmail(mockUser.email);

  const workspaceMember = await db.findWorkspaceMemberByUserId(
    account.id,
    t.context.workspace.id
  );

  t.true(workspaceMember.is_admin);

  t.is(workspaceMember.user_id, account.id);
});

test("/api/workspace/member/bulk/:workspace_id (add a new members but they do not have a account and the email does not match the school domain)", async t => {
  const generateUserEmails = db.generateRandomUserEmails(2);

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generateUserEmails.map(email => ({ email, admin: true }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: generateUserEmails.map(email => ({
      email,
      is_admin: true,
      invited: false,
      error_code: InvitationError.DOMAIN_EXCEPTION
    }))
  });

  const workspaceMembers = await db.returnWorkspaceMembers(
    t.context.workspace.id
  );

  t.is(workspaceMembers.length, 1);

  const invitations = await db.returnInvitationsBySchoolId(
    t.context.workspace.school_id
  );

  t.is(invitations.length, 0);
});

test("/api/workspace/member/bulk/:workspace_id (add a new member but they do not have a account but a invitation exist)", async t => {
  const generateUserEmails = db.generateUserEmails(t.context.user.domain, 1);

  await db.createInvitation(
    generateUserEmails[0],
    InvitationRoles.STUDENT,
    t.context.workspace.school_id
  );

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: generateUserEmails.map(email => ({
        email,
        admin: true
      }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: generateUserEmails.map(email => ({
      email,
      added: true,
      invited: true,
      is_admin: true
    }))
  });

  const member = await db.findWorkspaceMemberByUserId(
    generateUserEmails[0],
    t.context.workspace.id
  );

  t.true(member.is_admin);

  t.false(member.removed);
});

test("/api/workspace/member/bulk/:workspace_id (adding a existing members to the workspace)", async t => {
  const newUsers = await Promise.all([
    await db.createUser({
      role: InvitationRoles.STUDENT,
      school_id: t.context.workspace.school_id
    }),
    await db.createUser({
      role: InvitationRoles.STUDENT,
      school_id: t.context.workspace.school_id
    }),
    await db.createUser({
      role: InvitationRoles.STUDENT,
      school_id: t.context.workspace.school_id
    }),
    await db.createUser({
      role: InvitationRoles.STUDENT,
      school_id: t.context.workspace.school_id
    })
  ]);

  await Promise.all(
    newUsers.map(
      async user =>
        await db.createWorkspaceMember(user.id, t.context.workspace.id)
    )
  );

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: newUsers.map(user => ({
        admin: true,
        email: user.email
      }))
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: newUsers.map(user => ({
      added: false,
      is_admin: true,
      email: user.email,
      error_code: WorkspaceMemberError.WORKSPACE_MEMBER_EXIST_EXCEPTION
    }))
  });
});

test("/api/workspace/member/bulk/:workspace_id (adding a back removed members)", async t => {
  const newUser = await db.createUser({
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  await db.createWorkspaceMember(newUser.id, t.context.workspace.id, {
    removed: true,
    is_admin: true
  });

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .send({
      members: [
        {
          admin: false,
          email: newUser.email
        }
      ]
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    response: [
      {
        added: true,
        is_admin: false,
        email: newUser.email
      }
    ]
  });

  const member = await db.findWorkspaceMemberByUserId(
    newUser.id,
    t.context.workspace.id
  );

  t.false(member.is_admin);

  t.false(member.removed);
});

test("/api/workspace/member/bluk/:workspace_id (uploading a csv of the class roaster)", async t => {
  await db.updateSchoolInfo(t.context.workspace.school_id, {
    domain: null
  });
  const roaster = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "fixtures",
    "sample_roaster.csv"
  );

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`)
    .attach("roaster", roaster);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  const worksapceMembers = await db.returnWorkspaceMembers(
    t.context.workspace.id
  );

  t.is(worksapceMembers.length, 4);

  const invitations = await db.returnInvitationsBySchoolId(
    t.context.workspace.school_id
  );

  t.is(invitations.length, 3);
});

test("/api/workspace/member/bluk/:workspace_id (uploading a bad csv of the class roaster)", async t => {
  await db.updateSchoolInfo(t.context.workspace.school_id, {
    domain: null
  });
  const roaster = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "fixtures",
    "bad_sample_roaster.csv"
  );

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`)
    .attach("roaster", roaster);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(response.body.error_code, CSV_FILE_EXCEPTION);
});

test("/api/workspace/member/info/:workspace_id", async t => {
  const status = "AWAY";
  const response = await request(app)
    .patch(`/api/workspace/member/info/${t.context.workspace.id}`)
    .send({ status })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, { member_status: status });

  const member = await db.findWorkspaceMemberByUserId(
    t.context.user.id,
    t.context.workspace.id
  );

  t.log(member);

  t.is(member.status, status);
});

test("/api/workspace/member/bluk/:workspace_id (uploading a text instead of a csv)", async t => {
  const roaster = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "fixtures",
    "some-random-empty-file.txt"
  );

  const response = await request(app)
    .post(`/api/workspace/member/bulk/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`)
    .attach("roaster", roaster);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code 400");

  t.is(response.body.error_code, FileError.INVALID_FILE_EXCEPTION);
});

test("/api/workspace/member/info/:workspace_id (update member info in a workspace that does not exist)", async t => {
  const response = await request(app)
    .patch("/api/workspace/member/info/sjdnlfkndsjkfknjdslnkl")
    .send({ status: "AWAY" })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.deepEqual(
    response.body.error_code,
    WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION
  );
});

test("/api/workspace/member/info/:workspace_id (update member info in a workspace but the user is not a member of the workspace)", async t => {
  await db.updateWorkspaceMemberInfo(
    t.context.user.id,
    t.context.workspace.id,
    {
      removed: true
    }
  );

  const response = await request(app)
    .patch(`/api/workspace/member/info/${t.context.workspace.id}`)
    .send({ status: "AWAY" })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.deepEqual(
    response.body.error_code,
    WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION
  );
});

test("/api/workspace/member/members/:workspace_id", async t => {
  // creating a new user
  const newUser = await db.createUser({
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  await db.createWorkspaceMember(newUser.id, t.context.workspace.id);

  const response = await request(app)
    .get(`/api/workspace/member/members/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.is(response.body.next_page, -1);

  t.is(response.body.page, 1);

  t.is(response.body.limit, 20);

  t.is(response.body.results.length, 2);

  const responsThree = await request(app)
    .get(`/api/workspace/member/members/${t.context.workspace.id}?page=2`)
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(responsThree, null, 4));

  t.is(responsThree.status, 200, "should return a status code 200");

  t.is(responsThree.body.results.length, 0);
});

test("/api/workspace/member/invited/members/:workspace_id", async t => {
  // adding another member that does not have a account
  const [generateUserEmail] = db.generateUserEmails(t.context.user.domain, 1);
  await db.createWorkspaceMember(generateUserEmail, t.context.workspace.id);

  const response = await request(app)
    .get(`/api/workspace/member/invited/members/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    page: 1,
    limit: 20,
    next_page: -1,
    results: [{ email: generateUserEmail, is_admin: false }]
  });
});

test("/api/workspace/member/invited/members/:workspace_id (a non workspace admin requesting list of invited workspace members)", async t => {
  // adding another member that does not have a account
  const [generateUserEmail] = db.generateUserEmails(t.context.user.domain, 1);
  await db.createWorkspaceMember(generateUserEmail, t.context.workspace.id);

  // creating a new user
  const newUser = await db.createUser({
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  await db.createWorkspaceMember(newUser.id, t.context.workspace.id);

  const response = await request(app)
    .get(`/api/workspace/member/invited/members/${t.context.workspace.id}`)
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  t.deepEqual(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
  );
});

test("/api/workspace/member/search/:workspace_id", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  await db.createWorkspaceMember(newUser.id, t.context.workspace.id);

  const response = await request(app)
    .get(`/api/workspace/member/search/${t.context.workspace.id}?search=j`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.is(response.body.next_page, -1);

  t.is(response.body.page, 1);

  t.is(response.body.limit, 20);

  t.is(response.body.results.length, 1);
});

test("/api/workspace/member/info/:workspace_id/:memebr_user_id", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  const memberInfo = await db.createWorkspaceMember(
    newUser.id,
    t.context.workspace.id
  );

  const response = await request(app)
    .get(`/api/workspace/member/info/${t.context.workspace.id}/${newUser.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, {
    email: newUser.email,
    status: memberInfo.status,
    removed: memberInfo.removed,
    user_id: memberInfo.user_id,
    photo_url: newUser.photo_url,
    is_admin: memberInfo.is_admin,
    is_active: memberInfo.is_active,
    last_active_at: memberInfo.last_active_at,
    name: `${newUser.first_name} ${newUser.last_name}`,
    joined_at: new Date(memberInfo.joined_at).toISOString()
  });
});

test("/api/workspace/member/info/:workspace_id/:memebr_user_id (fetching user if but the user is not a member of the workspace)", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  const response = await request(app)
    .get(
      `/api/workspace/member/info/${t.context.workspace.id}/${t.context.user.id}`
    )
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return a status code 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/member/admin/:workspace_id/:memebr_user_id", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  const memberInfo = await db.createWorkspaceMember(
    newUser.id,
    t.context.workspace.id,
    {
      is_admin: false
    }
  );

  const response = await request(app)
    .put(
      `/api/workspace/member/admin/${t.context.workspace.id}/${memberInfo.user_id}`
    )
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  t.deepEqual(response.body, { is_admin: true });

  let workspaceMemberInfo = await db.findWorkspaceMemberByUserId(
    newUser.id,
    t.context.workspace.id
  );

  t.true(workspaceMemberInfo.is_admin);

  const responseTwo = await request(app)
    .put(
      `/api/workspace/member/admin/${t.context.workspace.id}/${memberInfo.user_id}`
    )
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return a status code 200");

  workspaceMemberInfo = await db.findWorkspaceMemberByUserId(
    newUser.id,
    t.context.workspace.id
  );

  t.false(workspaceMemberInfo.is_admin);
});

test("/api/workspace/member/admin/:workspace_id/:memebr_user_id (a non workspace admin attempting to update a workspace member to be a admin permission)", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  await db.createWorkspaceMember(newUser.id, t.context.workspace.id, {
    is_admin: false
  });

  const response = await request(app)
    .put(
      `/api/workspace/member/admin/${t.context.workspace.id}/${t.context.user.id}`
    )
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
  );
});

test("/api/workspace/member/admin/:workspace_id/:memebr_user_id (a admin update there own premission)", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  const memberInfo = await db.createWorkspaceMember(
    newUser.id,
    t.context.workspace.id,
    {
      is_admin: true
    }
  );

  const response = await request(app)
    .put(
      `/api/workspace/member/admin/${t.context.workspace.id}/${memberInfo.user_id}`
    )
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
  );
});

test("/api/workspace/member/remove/:workspace_id/:memebr_user_id", async t => {
  // creating a new user
  const newUser = await db.createUser({
    last_name: "doe",
    first_name: "john",
    role: InvitationRoles.STUDENT,
    school_id: t.context.workspace.school_id
  });

  // adding a new member to the workspace
  const memberInfo = await db.createWorkspaceMember(
    newUser.id,
    t.context.workspace.id
  );

  const response = await request(app)
    .delete(
      `/api/workspace/member/remove/${t.context.workspace.id}/${memberInfo.user_id}`
    )
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code 200");

  const workspaceMemberInfo = await db.findWorkspaceMemberByUserId(
    memberInfo.user_id,
    t.context.workspace.id
  );

  t.true(workspaceMemberInfo.removed);
});

test("/api/workspace/member/remove/:workspace_id/:memebr_user_id (a admin attempting to remove themselves from the workspace)", async t => {
  const response = await request(app)
    .delete(
      `/api/workspace/member/remove/${t.context.workspace.id}/${t.context.user.id}`
    )
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status code 401");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.WORKSPACE_MEMBER_PREMISSION_EXCEPTION
  );
});
