// requiring the dotenv library to load all env varibles for testing purposes
import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";

interface Context {
  registration: { name: string; domain?: string };
  admins: string[];
}
const test = ava as TestInterface<Context>;

// database helper functions
import * as db from "../helper";

// config
import { APP_NAME } from "../../config";

import app from "../../index";

// error codes
import { INTERNAL_SERVER_ERROR } from "../../common/error-codes";
import RegistryError from "../../routes/registry/error-codes";

test.beforeEach(async t => {
  // The request that be sent to the backend
  t.context.registration = db.createMockSchoolInfo();

  t.context.admins = db.generateUserEmails(t.context.registration.domain, 2);
});

test.afterEach.always(async t => {
  await db.clearInvitations();

  await db.clearRegistry();
});

test("/api/registry/register", async t => {
  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code of 200");

  t.is(typeof response.body.school_id, "string");

  const registeredSchool = await db.findSchoolbyId(response.body.school_id);

  t.is(response.body.school_id, registeredSchool.id);

  t.is(typeof registeredSchool.license_key, "string");

  t.deepEqual(
    {
      type: registeredSchool.type,
      name: registeredSchool.name,
      domain: registeredSchool.domain,
      deactivated: registeredSchool.deactivated
    },
    {
      type: "",
      deactivated: false,
      name: t.context.registration.name,
      domain: t.context.registration.domain
    }
  );
});

test("/api/registry/register (inserting a school with no domain)", async t => {
  delete t.context.registration.domain;

  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code of 200");

  t.is(typeof response.body.school_id, "string");

  const registeredSchool = await db.findSchoolbyId(response.body.school_id);

  t.is(response.body.school_id, registeredSchool.id);
});

test("/api/registry/register (trying to register the same school again)", async t => {
  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code of 200");

  t.is(typeof response.body.school_id, "string");

  const registeredSchool = await db.findSchoolbyId(response.body.school_id);

  t.not(registeredSchool, null);

  t.is(response.body.school_id, registeredSchool.id);

  const responseTwo = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 400, "should return a status code of 400");

  t.is(responseTwo.body.error_code, RegistryError.REGISTRATION_EXIST_EXCEPTION);

  t.context.registration.name =
    t.context.registration.name[0].toUpperCase() +
    t.context.registration.name.slice(1);

  const responseThree = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(responseThree, null, 4));

  t.is(
    responseThree.status,
    400,
    "should return a status code of 400, for case-insensitive as well"
  );

  t.is(
    responseThree.body.error_code,
    RegistryError.REGISTRATION_EXIST_EXCEPTION
  );
});

test("/api/registry/register (trying to register the same school again, but not providing a domain)", async t => {
  delete t.context.registration.domain;

  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code of 200");

  t.is(typeof response.body.school_id, "string");

  const registeredSchool = await db.findSchoolbyId(response.body.school_id);

  t.not(registeredSchool, null);

  t.is(response.body.school_id, registeredSchool.id);

  const responseTwo = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 400, "should return a status code of 400");

  t.deepEqual(
    { error_code: responseTwo.body.error_code },
    {
      error_code: RegistryError.REGISTRATION_EXIST_EXCEPTION
    }
  );
});

test("/api/registry/register (sending invalid data)", async t => {
  // wrong request body
  const requestBody = {
    school_name: "",
    domain: "gmail.com",
    admins: [
      "johndoe@gmailcom",
      {
        email: `jane.doe@${t.context.registration.domain}`
      }
    ]
  };

  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(requestBody);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status code of 400");

  t.deepEqual(response.body, {
    context: {
      errors: [
        { message: "the domain must be a valid email domain", field: "domain" },
        {
          message:
            "You must provide the name of the school you are registering",
          field: "name"
        },
        { message: '"school_name" is not allowed', field: "school_name" },
        { message: '"admins" is not allowed', field: "admins" }
      ]
    },
    message: "There seems to be issue with the information provided",
    error_code: "VALIDATION_EXCEPTION"
  });
});

test("/api/registry/register (providing a fake api key)", async t => {
  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", "ndsjksnklfsdnklfsndlknkl");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401);

  const responseTwo = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", "FEFEFE");

  t.log(JSON.stringify(response, null, 4));

  t.is(responseTwo.status, 401);

  const responseThree = await request(app).post("/api/registry/register");

  t.log(JSON.stringify(responseThree, null, 4));

  t.is(responseThree.status, 401);
});

test("/api/registry/invite/admin/bulk", async t => {
  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code of 200");

  const responseTwo = await request(app)
    .post("/api/registry/invite/admin/bulk")
    .set("x-api-key", process.env.API_KEY)
    .send({
      school_id: response.body.school_id,
      emails: t.context.admins
    });

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return a status code of 200");

  t.deepEqual(responseTwo.body, { sent: true });

  const invitations = await db.returnInvitationsBySchoolId(
    response.body.school_id
  );
  t.log(invitations);

  t.is(invitations.length, 2, "admin invitations should exist");

  const [email] = t.context.admins;
  const adminInvitation = await db.findInvitationByEmail(email);

  t.is(adminInvitation.from, APP_NAME);

  t.deepEqual(
    {
      from: adminInvitation.from,
      type: adminInvitation.type,
      school_id: adminInvitation.school_id
    },
    {
      type: "admin",
      from: APP_NAME,
      school_id: response.body.school_id
    }
  );
});

test("/api/registry/invite/admin/bulk (sending invalid data)", async t => {
  const response = await request(app)
    .post("/api/registry/invite/admin/bulk")
    .set("x-api-key", process.env.API_KEY)
    .send({
      school_id: 2323
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status code of 400");

  t.deepEqual(response.body, {
    context: {
      errors: [
        { message: '"school_id" must be a string', field: "school_id" },
        { message: '"emails" is required', field: "emails" }
      ]
    },
    message: "There seems to be issue with the information provided",
    error_code: "VALIDATION_EXCEPTION"
  });

  const responseTwo = await request(app)
    .post("/api/registry/invite/admin/bulk")
    .set("x-api-key", process.env.API_KEY)
    .send({
      school_id: "2323",
      emails: ["some-fake-text"]
    });

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 400, "should return a status code of 400");
});

test("/api/registry/invite/admin/bulk (sending a bulk invite for a school, that does not exist)", async t => {
  const response = await request(app)
    .post("/api/registry/invite/admin/bulk")
    .set("x-api-key", process.env.API_KEY)
    .send({
      school_id: "fake_school_id",
      emails: t.context.admins
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 500, "should return a status code of 500");

  t.deepEqual(response.body.error_code, INTERNAL_SERVER_ERROR);

  const invitations = await db.returnInvitationsBySchoolId(
    response.body.school_id
  );

  t.is(invitations.length, 0, "admin invitations should not exist");
});

test("/api/registry/register (providing a domain, but some of the the admins email do not match the domain)", async t => {
  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status code of 200");

  t.context.admins = [
    ...t.context.admins,
    t.context.admins[0],
    "jane.doe@gmail.com",
    "michealcera@scottpilgrimversetheworld.net"
  ];

  const responseTwo = await request(app)
    .post("/api/registry/invite/admin/bulk")
    .set("x-api-key", process.env.API_KEY)
    .send({
      school_id: response.body.school_id,
      emails: t.context.admins
    });

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return a status code of 200");

  const invitations = await db.returnInvitationsBySchoolId(
    response.body.school_id
  );

  t.log(invitations);

  t.is(invitations.length, 2, "There should only be two admin invites");

  t.notDeepEqual(invitations, [], "This should not be a empty array");
});

test("/api/registry/search", async t => {
  t.context.registration.name = "andre's school";

  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status of 200");

  const responseTwo = await request(app).get("/api/registry/search");

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return status of 200");

  t.deepEqual(responseTwo.body, {
    next_page: -1,
    result: [
      {
        name: t.context.registration.name,
        photo_url: ""
      }
    ],
    search: "",
    limit: 15
  });

  const responseThree = await request(app).get(
    "/api/registry/search?search=we"
  );

  t.log(JSON.stringify(responseThree, null, 4));

  t.is(responseThree.status, 200, "should return status of 200");

  t.deepEqual(responseThree.body, {
    next_page: -1,
    search: "we",
    result: [],
    limit: 15
  });

  const responseFour = await request(app).get(
    "/api/registry/search?page=3&limit=hell"
  );

  t.log(JSON.stringify(responseFour, null, 4));

  t.is(responseFour.status, 200, "should return status of 200");

  t.deepEqual(responseFour.body, {
    next_page: -1,
    result: [],
    search: "",
    limit: 15
  });
});
