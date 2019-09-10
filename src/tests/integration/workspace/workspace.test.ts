import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";

// error codes
import WorkspaceMemberError from "../../../routes/workspace/member/error-codes";
import AuthenticationError from "../../../routes/authentication/error-codes";
import WorkspaceError from "../../../routes/workspace/error-codes";

// database helper functions
import * as db from "../../helper";

// config
import { ValidationJsonResponse } from "../../../config";
const validationJsonResponse = ValidationJsonResponse();

interface Context {
  user: {
    id: string;
    token: string;
    school_id: string;
  };
}
const test = ava as TestInterface<Context>;

// types
import { WorkspaceTypes, WorkspaceScopes } from "../../../routes/workspace";
import { InvitationRoles } from "../../../routes/invitation";

import app from "../../../index";

// before each test create user, school and pass the context to the all the test of the user and the school
test.beforeEach(async t => {
  // generated a new random school
  const generatedSchool = await db.createSchool();

  const mockUser = db.createMockUserInfo(
    generatedSchool.name,
    generatedSchool.domain,
    "professor"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      school_id: generatedSchool.id
    })
  );

  t.context.user = {
    id: newUser.id,
    token: newUser.token,
    school_id: generatedSchool.id
  };
});

test.afterEach.always(async t => {
  await db.clearWorkspaces();

  await db.clearRegistry();

  await db.clearUsers();
});

test("/api/workspace/create", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const response = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 201, "should return status of 201");

  t.deepEqual(mockWorkspace, {
    name: response.body.name,
    type: response.body.type,
    scope: response.body.scope,
    section: response.body.section,
    description: response.body.description
  });

  const workspace = await db.findWorkspaceById(response.body.id);

  t.false(workspace.archived);

  t.is(workspace.creator, t.context.user.id, "the should match the user id");

  t.is(
    workspace.school_id,
    t.context.user.school_id,
    "should match the school id"
  );

  const workspaceMembers = await db.returnWorkspaceMembers(response.body.id);

  t.is(workspaceMembers.length, 1);

  const workspaceMember = workspaceMembers[0];
  t.deepEqual(
    {
      user_id: workspaceMember.user_id,
      is_admin: workspaceMember.is_admin,
      workspace_id: workspaceMember.workspace_id
    },
    {
      is_admin: true,
      user_id: t.context.user.id,
      workspace_id: response.body.id
    }
  );
});

test("/api/workspace/create (sending invalid data)", async t => {
  const response = await request(app)
    .post("/api/workspace/create")
    .send({
      name: true,
      scope: "PUBLIC",
      type: "my-type",
      section: " sdnc nsdknkl  skl",
      description: "hello world".repeat(132)
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status of 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/api/workspace/create (only providing the name of workspace, default values)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const response = await request(app)
    .post("/api/workspace/create")
    .send({
      name: mockWorkspace.name,
      section: mockWorkspace.section
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 201, "should return status of 201");

  const workspace = await db.findWorkspaceById(response.body.id);

  t.deepEqual(
    {
      type: workspace.type,
      name: workspace.name,
      scope: workspace.scope,
      creator: workspace.creator,
      section: workspace.section,
      school_id: workspace.school_id,
      description: workspace.description
    },
    {
      description: "",
      name: mockWorkspace.name,
      creator: t.context.user.id,
      type: WorkspaceTypes.class,
      section: mockWorkspace.section,
      scope: WorkspaceScopes.private,
      school_id: t.context.user.school_id
    }
  );

  const [workspaceMember] = await db.returnWorkspaceMembers(response.body.id);

  t.deepEqual(
    {
      user_id: workspaceMember.user_id,
      is_admin: workspaceMember.is_admin,
      workspace_id: workspaceMember.workspace_id
    },
    {
      is_admin: true,
      user_id: t.context.user.id,
      workspace_id: response.body.id
    }
  );
});

test("/api/workspace/create (creating a workspace without providing the section)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const response = await request(app)
    .post("/api/workspace/create")
    .send({
      name: mockWorkspace.name
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status of 400");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_SECTION_EXECPTION);
});

test("/api/workspace/create (creating the same workspace twice)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const response = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 201, "should return status of 201");

  const responseTwo = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(responseTwo.status, 400, "should return status of 400");

  t.is(responseTwo.body.error_code, WorkspaceError.WORKSPACE_EXIST_EXCEPTION);
});

test("/api/workspace/create (can creating workspaces with the same name but different field values)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const response = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 201, "should return status of 201");

  mockWorkspace.section = "HEL2";
  mockWorkspace.scope = WorkspaceScopes.public;

  const responseTwo = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(responseTwo.status, 201, "should return status of 200");
});

test("/api/workspace/create (a student attempts to create a workspace)", async t => {
  await db.updateUserInfo(t.context.user.id, { role: InvitationRoles.STUDENT });

  const mockWorkspace = db.createMockWorkspaceInfo();

  const response = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_ROLE_PREMISSION_EXCEPTION
  );
});

test("/api/workspace/create (creating the same workspace, but the matching workspace is archived)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign(
      {
        archived: true
      },
      mockWorkspace
    )
  );

  const response = await request(app)
    .post("/api/workspace/create")
    .send(mockWorkspace)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 403, "should return status of 403");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION);
});

test("/api/workspace/info/:workspace_id [PATCH]", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  const newDescription = `HELLO ${workspace.name}`;
  const response = await request(app)
    .patch(`/api/workspace/info/${workspace.id}`)
    .send({
      type: WorkspaceTypes.club,
      description: newDescription
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, {
    name: workspace.name,
    scope: workspace.scope,
    type: WorkspaceTypes.club,
    section: workspace.section,
    description: newDescription
  });

  const workspaceInfo = await db.findWorkspaceById(workspace.id);

  t.is(workspaceInfo.description, newDescription);

  t.is(workspaceInfo.type, WorkspaceTypes.club);
});

test("/api/workspace/info/:workspace_id [PATCH] (sending invalid data)", async t => {
  const response = await request(app)
    .patch(`/api/workspace/info/dfdfsds`)
    .send({
      description: "repeat".repeat(132),
      scope: "PrIvAtE",
      name: 138903
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status of 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/api/workspace/info/:workspace_id [PATCH] (updating a workspace that does not exist)", async t => {
  const response = await request(app)
    .patch("/api/workspace/info/dfdfsds")
    .send({
      description: "This workspace does not exist"
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status of 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/info/:workspace_id [PATCH] (updating a workspace that is archived)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign({ archived: true }, mockWorkspace)
  );

  const response = await request(app)
    .patch(`/api/workspace/info/${workspace.id}`)
    .send({
      description: "This workspace is archived"
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 403, "should return status of 403");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_ARCHIVED_EXCEPTION);
});

test("/api/workspace/info/:workspace_id [PATCH] (updating a workspace but another workspace already exists)", async t => {
  const otherMockWorkspace = db.createMockWorkspaceInfo();
  await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign(otherMockWorkspace, { scope: WorkspaceScopes.public })
  );

  const mockWorkspace = db.createMockWorkspaceInfo();
  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  const response = await request(app)
    .patch(`/api/workspace/info/${workspace.id}`)
    .send({
      scope: WorkspaceScopes.public,
      name: otherMockWorkspace.name,
      section: otherMockWorkspace.section,
      description: "This workspace exist but is archived"
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status of 400");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_EXIST_EXCEPTION);
});

test("/api/workspace/archive/:workspace_id", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  const response = await request(app)
    .put(`/api/workspace/archive/${workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, { archived: true });

  const workspaceInfo = await db.findWorkspaceById(workspace.id);

  t.true(workspaceInfo.archived);
});

test("/api/workspace/archive/:workspace_id (archiving a workspace that does not exist)", async t => {
  const response = await request(app)
    .put("/api/workspace/archive/workspace.id")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status of 405");

  t.deepEqual(
    response.body.error_code,
    WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION
  );
});

test("/api/workspace/archive/:workspace_id (admin archiving a workspace)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  const admin = await db.createUser({
    role: InvitationRoles.ADMIN,
    school_id: t.context.user.school_id
  });

  const response = await request(app)
    .put(`/api/workspace/archive/${workspace.id}`)
    .set("x-token", `Bearer ${admin.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, { archived: true });

  const workspaceInfo = await db.findWorkspaceById(workspace.id);

  t.true(workspaceInfo.archived);
});

test("/api/workspace/archive/:workspace_id (unarchiving a workspace that does not exist)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign({ archived: true }, mockWorkspace)
  );

  const response = await request(app)
    .put(`/api/workspace/archive/${workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, { archived: false });

  const workspaceInfo = await db.findWorkspaceById(workspace.id);

  t.false(workspaceInfo.archived);
});

test("/api/workspace/info/:workspace_id", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  const response = await request(app)
    .get(`/api/workspace/${workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  const workspaceMember = await db.findWorkspaceMemberByUserId(
    t.context.user.id,
    workspace.id
  );

  workspace.created_at = new Date(workspace.created_at).toISOString();
  workspaceMember.joined_at = new Date(workspaceMember.joined_at).toISOString();

  t.deepEqual(response.body, {
    id: workspace.id,
    name: workspace.name,
    type: workspace.type,
    scope: workspace.scope,
    section: workspace.section,
    archived: workspace.archived,
    created_at: workspace.created_at,
    description: workspace.description,
    meta: {
      status: workspaceMember.status,
      is_admin: workspaceMember.is_admin,
      is_active: workspaceMember.is_active,
      joined_at: workspaceMember.joined_at,
      last_active_at: workspaceMember.last_active_at,
      is_creator: t.context.user.id === workspace.creator
    }
  });
});

test("/api/workspace/info/:workspace_id (user is not a member of the public workspace)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  mockWorkspace.scope = WorkspaceScopes.public;
  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  await db.updateWorkspaceMemberInfo(t.context.user.id, workspace.id, {
    removed: true
  });

  const response = await request(app)
    .get(`/api/workspace/${workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status of 400");

  t.is(
    response.body.error_code,
    WorkspaceMemberError.NOT_WORKSPACE_MEMBER_EXCEPTION
  );
});

test("/api/workspace/info/:workspace_id (user is not a member of the private workspace)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  await db.updateWorkspaceMemberInfo(t.context.user.id, workspace.id, {
    removed: true
  });

  const response = await request(app)
    .get(`/api/workspace/${workspace.id}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status of 404");

  t.is(response.body.error_code, WorkspaceError.WORKSPACE_NOT_FOUND_EXCEPTION);
});

test("/api/workspace/", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  const response = await request(app)
    .get("/api/workspace/")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  const workspaceMember = await db.findWorkspaceMemberByUserId(
    t.context.user.id,
    workspace.id
  );

  workspace.created_at = new Date(workspace.created_at).toISOString();
  workspaceMember.joined_at = new Date(workspaceMember.joined_at).toISOString();

  t.deepEqual(response.body, {
    workspaces: [
      {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        scope: workspace.scope,
        section: workspace.section,
        archived: workspace.archived,
        created_at: workspace.created_at,
        description: workspace.description,
        meta: {
          status: workspaceMember.status,
          is_admin: workspaceMember.is_admin,
          is_active: workspaceMember.is_active,
          joined_at: workspaceMember.joined_at,
          last_active_at: workspaceMember.last_active_at,
          is_creator: t.context.user.id === workspace.creator
        }
      }
    ]
  });
});

test("/api/workspace/ (the user is not a member of the workspace)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    mockWorkspace
  );

  await db.updateWorkspaceMemberInfo(t.context.user.id, workspace.id, {
    removed: true
  });

  const response = await request(app)
    .get("/api/workspace/")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, {
    workspaces: []
  });
});

test("/api/workspace/ (the workspace is archived)", async t => {
  const mockWorkspace = db.createMockWorkspaceInfo();

  await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign({ archived: true }, mockWorkspace)
  );

  const response = await request(app)
    .get("/api/workspace/")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, {
    workspaces: []
  });
});

test("/api/workspace/search", async t => {
  const workspace = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign(db.createMockWorkspaceInfo(), { name: "workspace_1" })
  );

  const workspaceTwo = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign(db.createMockWorkspaceInfo(), {
      name: "workspace_2",
      scope: WorkspaceScopes.public
    })
  );

  const workspaceThree = await db.createWorkspace(
    t.context.user.id,
    t.context.user.school_id,
    Object.assign(db.createMockWorkspaceInfo(), { name: "workspace_3" })
  );

  await db.updateWorkspaceMemberInfo(t.context.user.id, workspaceTwo.id, {
    removed: true
  });

  const response = await request(app)
    .get("/api/workspace/search")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 2));

  t.is(response.status, 200, "should return status of 200");

  t.deepEqual(response.body, {
    page: 1,
    limit: 15,
    search: "",
    results: [],
    next_page: -1
  });

  const responseTwo = await request(app)
    .get("/api/workspace/search?search=w")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(responseTwo, null, 2));

  t.is(responseTwo.status, 200, "should return status of 200");

  t.deepEqual(responseTwo.body.page, 1);

  t.deepEqual(responseTwo.body.next_page, -1);

  t.deepEqual(responseTwo.body.results.length, 3);

  await db.updateWorkspaceMemberInfo(t.context.user.id, workspaceThree.id, {
    removed: true
  });

  const responseThree = await request(app)
    .get("/api/workspace/search?search=workspace_")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(responseThree, null, 2));

  t.is(responseThree.status, 200, "should return status of 302");

  t.is(responseThree.body.results.length, 2);
});
