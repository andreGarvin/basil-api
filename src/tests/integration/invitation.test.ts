import { URL } from "url";

import * as dotenv from "dotenv";
dotenv.config();

import { test } from "ava";
import * as request from "supertest";
import * as faker from "faker";

// interface Context {
//   school: {
//     id?: string;
//   };
//   user: {
//     id: string;
//     role: string;
//     email: string;
//     token: string;
//   };
//   invitation: {
//     send: {
//       type: string;
//       email: string;
//     };
//     bulk: {
//       type: string;
//       emails: string[];
//     };
//     update: {
//       type: string;
//       email: string;
//     };
//   };
// }
// const test = ava as TestInterface<Context>;

// invitation error codes
import AuthenticationError from "../../routes/authentication/error-codes";
import InvitationError from "../../routes/invitation/error-codes";

// database helper functions
import * as db from "../helper";

// config
import { ValidationJsonResponse, WEB_APP_HOST } from "../../config";

import app from "../../index";

// before each test create user, school and pass the context to the all the test of the user and the school
test.beforeEach(async t => {
  // creating a new school
  const generatedSchool = await db.createSchool();

  t.context.school = {
    id: generatedSchool.id
  };

  // generated a random user
  const newUser = await db.createUser({
    school_id: t.context.school.id,
    role: "admin"
  });

  t.context.user = {
    id: newUser.id,
    role: newUser.role,
    token: newUser.token,
    email: newUser.email
  };

  const testEmail = faker.internet.email(
    faker.name.firstName(),
    faker.name.lastName(),
    generatedSchool.domain.slice(1)
  );
  // the invitation being sent to the backend
  t.context.invitation = {
    send: {
      // this is the domain strict email
      email: testEmail,
      type: "student"
    },
    update: {
      email: testEmail,
      type: "professor"
    },
    bulk: {
      type: "student",
      emails: [
        faker.internet.email(
          faker.name.firstName(),
          faker.name.lastName(),
          generatedSchool.domain.slice(1)
        ),
        faker.internet.email(
          faker.name.firstName(),
          faker.name.lastName(),
          generatedSchool.domain.slice(1)
        ),
        faker.internet.email(
          faker.name.firstName(),
          faker.name.lastName(),
          generatedSchool.domain.slice(1)
        )
      ]
    }
  };
});

test.afterEach.always(async t => {
  await db.clearInvitations();

  await db.clearRegistry();

  await db.clearUsers();
});

test("/api/invitation/send", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200, "Should have status code of 200");

  const invitation = await db.findInvitationById(response.body.id);

  // checking that the 'from' field matches the user uid
  t.is(
    invitation.from,
    t.context.user.id,
    "The user uid should match the user who sent the request to create the invitation"
  );

  /* checking that the school code of the email is the same
    recently create class and the user who created the
    invitation */
  t.is(
    invitation.school_id,
    t.context.school.id,
    "school id should match the school that was created"
  );

  t.deepEqual(
    {
      type: t.context.invitation.send.type,
      email: t.context.invitation.send.email
    },
    {
      type: invitation.type,
      email: invitation.email
    },
    "Both objects should match each other"
  );
});

test("/api/invitation/send (not sending required data)", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .send({ type: "foobarbaz" })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.is(
    response.status,
    400,
    "Should return a status code of 400 for bad request"
  );

  t.deepEqual(
    response.body,
    {
      error_code: ValidationJsonResponse.error_code,
      message: ValidationJsonResponse.message,
      context: {
        errors: [
          {
            field: "email",
            message: "must provide a valid email"
          },
          {
            field: "type",
            message: "must provide a valid invitation type"
          }
        ]
      }
    },
    "The request body should match the expected error response"
  );

  const invitation = await db.returnInvitationsBySchoolId(t.context.school.id);

  t.is(
    invitation.length,
    0,
    "there should not be any invitations under this school"
  );
});

test("/api/invitation/send (creating a invite that does not match the school domain)", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .send({
      type: "student",
      email: "john.doe@gmail.com"
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.is(response.status, 400, "Should return a status code of 400");

  t.is(response.body.error_code, InvitationError.DOMAIN_EXCEPTION);

  const invitation = await db.findInvitationById(response.body.id);

  t.is(invitation, null, "The record of the invitation does not exist");
});

test("/api/invitation/send (a user with a student role sending a invitation)", async t => {
  await db.updateUserInfo(t.context.user.id, { role: "student" });

  const response = await request(app)
    .post("/api/invitation/send")
    .send({
      type: "student",
      email: "john.doe@gmail.com"
    })
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.is(response.status, 401, "Should return a status code of 401");

  t.is(
    response.body.error_code,
    InvitationError.INVITATION_PREMISSION_EXCEPTION
  );

  const invitation = await db.findInvitationById(response.body.id);

  t.is(invitation, null, "The record of the invitation does not exist");
});

test("/api/invitation/send (account that a non admin role sending a admin invitation)", async t => {
  await db.updateUserInfo(t.context.user.id, { role: "professor" });

  t.context.invitation.send.type = "admin";

  // sending a student invite as a admin in of the school
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(
    response.status,
    401,
    "Should return a sucessful response for saving and send the invitation"
  );
});

test("/api/invitation/send (sending a email in school with no domain restriction)", async t => {
  // deleting the domain field from the school
  await db.updateSchoolInfo(t.context.school.id, { domain: null });

  t.context.invitation.send.email = "john.doe@gmail.com";
  t.context.invitation.send.type = "student";

  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);
  t.is(
    response.status,
    200,
    "Should return a sucessful response for saving and send the invitation"
  );

  const invitation = await db.findInvitationById(response.body.id);

  t.is(invitation.from, t.context.user.id);

  t.is(invitation.school_id, t.context.school.id);

  t.deepEqual(
    {
      school_code: t.context.school.id,
      email: t.context.invitation.send.email,
      type: t.context.invitation.send.type
    },
    {
      school_code: invitation.school_id,
      email: invitation.email,
      type: invitation.type
    }
  );
});

test("/api/invitation/send (sending a invitation but the school does not exist)", async t => {
  // deleting the school from the database
  await db.clearRegistry();

  const response = await request(app)
    .post("/api/invitation/send")
    .send(t.context.invitation.send)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.is(response.status, 500, "Should return status code 500");
});

test("/api/invitation/send (sending a invitation but the user aleady has a account)", async t => {
  // creating a user
  const userAccount = await db.createUser({
    school_id: t.context.school.id,
    role: "student"
  });

  t.context.invitation.send.email = userAccount.email;

  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 400, "Should return status code 400");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_EXIST_EXCEPTION,
    "the user account already exist EXCEPTION message"
  );
});

test("/api/invitation/send (sending a invitation but one was already sent)", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200, "Should return status code 200");

  const responseTwo = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(responseTwo.status, 400, "Should return status code 400");

  t.deepEqual(
    responseTwo.body.error_code,
    InvitationError.INVITATION_EXIST_EXCEPTION
  );

  const invitationCount = await db.returnInvitationsBySchoolId(
    t.context.school.id
  );

  t.is(invitationCount.length, 1, "should only be one document");
});

test("/api/invitation/send (sending a invitation but not providing the type of invitation)", async t => {
  delete t.context.invitation.send.type;

  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200, "Should return status code 200");

  const invitation = await db.findInvitationById(response.body.id);

  t.is(
    invitation.type,
    "student",
    "The type of invitation should default to student"
  );
});

test("/api/invitation/send (sending a invitation but providing a invalid type of invitation)", async t => {
  t.context.invitation.send.type = "THIS RIGHT";

  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 400, "Should return 400");

  t.is(response.body.error_code, ValidationJsonResponse.error_code);
});

test("/api/invitation/open/:invite_id", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(
    response.status,
    200,
    "Should return a sucessful response for saving and send the invitation"
  );

  const invitation = await db.findInvitationById(response.body.id);

  const responseTwo = await request(app).get(
    `/api/invitation/open/${invitation.id}`
  );

  t.is(
    responseTwo.status,
    302,
    "Should return status code to indicated it redirected"
  );

  const url = new URL(WEB_APP_HOST);
  url.pathname = "/signup";
  url.searchParams.set("role", t.context.invitation.send.type);
  url.searchParams.set("email", t.context.invitation.send.email);
  url.searchParams.set("school_id", t.context.school.id);

  t.is(
    responseTwo.header.location.replace("%40", "@"),
    url.href.replace("%40", "@"),
    "Should have redirected to the the /signup page on the web application"
  );
});

test("/api/invitation/open/:invite_id (providing bullshit invite id)", async t => {
  const url = new URL(WEB_APP_HOST);
  url.pathname = "/signup";

  const response = await request(app).get(
    "/api/invitation/open/nsdinflknvbjnidsnfdsbk"
  );

  t.is(response.status, 302);

  t.is(response.header.location, url.href);

  const responseTwo = await request(app).get(
    "/api/invitation/open/THIS_IS_SOME_BULL_SHIT"
  );

  t.is(responseTwo.status, 302);

  t.is(responseTwo.header.location, url.href);

  const responseThree = await request(app).get("/api/invitation/open/hey:yes");

  t.is(responseThree.status, 302);

  t.is(responseThree.header.location, url.href);
});

test("/api/invitation/update", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200);

  const invitation = await db.findInvitationByEmail(
    t.context.invitation.update.email
  );

  const responseTwo = await request(app)
    .put("/api/invitation/update")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.update);

  t.is(responseTwo.status, 200);

  const updateInvitation = await db.findInvitationByEmail(
    t.context.invitation.update.email
  );

  t.is(
    invitation.email,
    t.context.invitation.update.email,
    "should have update the old email to the new email"
  );

  t.not(invitation.last_updated_at, updateInvitation.last_updated_at);

  t.is(updateInvitation.type, t.context.invitation.update.type);
});

test("/api/invitation/update (sending invlalid data)", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200);

  // changing the 'type' field
  t.context.invitation.update.type = "SUPER_ADMIN";

  const responseTwo = await request(app)
    .put("/api/invitation/update")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.update);

  t.is(responseTwo.status, 400);

  t.is(responseTwo.body.error_code, ValidationJsonResponse.error_code);

  t.deepEqual(responseTwo.body.context.errors, [
    {
      field: "type",
      message: "must provide a valid invitation type"
    }
  ]);
});

test("/api/invitation/update (updating a invitation that does not exist)", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200);

  t.context.invitation.update.email = "john.doe@gmail.com";

  const responseTwo = await request(app)
    .put("/api/invitation/update")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.update);

  t.is(responseTwo.status, 404);

  t.is(
    responseTwo.body.error_code,
    InvitationError.INVITATION_NOT_FOUND_EXCEPTION
  );
});

test("/api/invitation/delete/:id", async t => {
  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200);

  const responseTwo = await request(app)
    .delete(`/api/invitation/delete/${t.context.invitation.send.email}`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.is(responseTwo.status, 200, "should return a status of 200");

  const invitation = await db.findInvitationById(response.body.id);

  t.is(invitation, null, "invtation still should exist");
});

test("/api/invitation/delete/:id (sending a request to delete a invitation that does not exist)", async t => {
  const response = await request(app)
    .delete(`/api/invitation/delete/fake-id`)
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.is(response.status, 200, "should return a status of 200");
});

test("/api/invitation/delete/:id (deleteing invitation that was not created by the same user account)", async t => {
  const otherUserAccount = await db.createUser({
    role: "professor",
    school_id: t.context.school.id
  });

  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200, "Should have status code of 200");

  const responseTwo = await request(app)
    .delete(`/api/invitation/delete/${t.context.invitation.send.email}`)
    .set("x-token", `Bearer ${otherUserAccount.token}`);

  t.is(responseTwo.status, 200, "should return a status of 200");

  const invitation = await db.findInvitationById(response.body.id);

  t.not(invitation, null, "invtation still should exist");
});

test("/api/invitation/delete/:id (deleteing invitation that was not created by user account as a admin)", async t => {
  const otherAdminAccount = await db.createUser({
    role: "admin",
    school_id: t.context.school.id
  });

  const response = await request(app)
    .post("/api/invitation/send")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.send);

  t.is(response.status, 200, "Should have status code of 200");

  const responseTwo = await request(app)
    .delete(`/api/invitation/delete/${t.context.invitation.send.email}`)
    .set("x-token", `Bearer ${otherAdminAccount.token}`);

  t.is(responseTwo.status, 200, "should return a status of 200");

  const invitation = await db.findInvitationById(response.body.id);

  t.is(invitation, null, "invtation still should exist");
});

test("/api/invitation/send/bulk", async t => {
  const response = await request(app)
    .post("/api/invitation/send/bulk")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.bulk);

  t.is(response.status, 200, "should return a 200");

  const expectedResponse = t.context.invitation.bulk.emails.map(email => {
    return { email, inserted: true };
  });

  t.deepEqual(response.body.response, expectedResponse);
});

test("/api/invitation/send/bulk (sending a invitations that does not match the school domain)", async t => {
  const randomDomain = faker.internet.domainName();
  const blockedEmails = [
    faker.internet.email(
      faker.name.firstName(),
      faker.name.lastName(),
      randomDomain
    ),
    faker.internet.email(
      faker.name.firstName(),
      faker.name.lastName(),
      randomDomain
    )
  ];

  t.context.invitation.bulk.emails.push(...blockedEmails);

  const response = await request(app)
    .post("/api/invitation/send/bulk")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send(t.context.invitation.bulk);

  t.is(response.status, 200, "should be a status code");

  const expectedResponse = t.context.invitation.bulk.emails.map(email => {
    const notInserted = email.endsWith(randomDomain);
    if (notInserted) {
      return {
        email,
        inserted: !notInserted,
        error_code: InvitationError.DOMAIN_EXCEPTION
      };
    }

    return {
      email,
      inserted: !notInserted
    };
  });

  t.deepEqual(response.body.response, expectedResponse);
});

test("/api/invitation/send/bulk (sending a invitation with invalid emails)", async t => {
  const response = await request(app)
    .post("/api/invitation/send/bulk")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send({
      emails: ["BULLSHIT"],
      type: "stud"
    });

  t.is(response.status, 400, "should be a 400 status code");

  t.is(response.body.error_code, ValidationJsonResponse.error_code);
});

test("/api/invitation/send/bulk (sending a batch of duplicate invites)", async t => {
  const response = await request(app)
    .post("/api/invitation/send/bulk")
    .set("x-token", `Bearer ${t.context.user.token}`)
    .send({
      emails: [
        t.context.invitation.send.email,
        t.context.invitation.send.email
      ],
      type: "student"
    });

  t.is(response.status, 200, "should be a 200 status code");

  const invitations = await db.returnInvitationsBySchoolId(t.context.school.id);

  t.is(invitations.length, 1, "There should only be one invitations");
});
