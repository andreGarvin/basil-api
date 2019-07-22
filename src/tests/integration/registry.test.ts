// requiring the dotenv library to load all env varibles for testing purposes
import * as dotenv from "dotenv";
dotenv.config();

import { test } from "ava";

import * as request from "supertest";

import * as uuid from "uuid/v4";

// models
import adminMemberModel from "../../routes/registry/models/member.model";
import registryModel from "../../routes/registry/models/registry.model";
import invitationModel from "../../routes/invitation/model";

// server
import app from "../../index";

// error codes
// import { VALIDATION_EXCEPTION } from "../../common/error-codes";
// import RegistryError from "../../routes/registry/error-codes";

test.beforeEach(async t => {
  const SCHOOL_NAME = uuid();

  const SCHOOL_DOMAIN = `@${SCHOOL_NAME}.edu`;

  // The request that be sent to the backend
  t.context.registration = {
    domain: SCHOOL_DOMAIN,
    name: SCHOOL_NAME,
    admins: [`jane.doe${SCHOOL_DOMAIN}`]
  };
});

test.afterEach.always(async t => {
  const school = await registryModel.findOne({
    name: t.context.registration.name
  });

  await registryModel.deleteMany({
    id: school.id
  });

  await adminMemberModel.deleteMany({
    school_id: school.id
  });

  await invitationModel.deleteMany({
    email: new RegExp(t.context.registration.domain)
  });
});

test.only("/api/registry/register", async t => {
  const response = await request(app)
    .post("/api/registry/register")
    .set("x-api-key", process.env.API_KEY)
    .send(t.context.registration);

  if (response.status !== 200) {
    t.log(response.body);
  }

  t.is(response.status, 200, "should return a status code of 200");

  t.is(typeof response.body.school_id, "string");

  const registeredSchool = await registryModel.findOne({
    name: t.context.registration.name
  });

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
      type: undefined,
      deactivated: false,
      name: t.context.registration.name,
      domain: t.context.registration.domain
    }
  );

  const adminMembers = await adminMemberModel.find({
    school_id: registeredSchool.id
  });

  t.is(adminMembers.length, 1, "admins should exist");

  const [adminMember] = adminMembers;

  t.deepEqual(
    [
      {
        user_id: adminMember.user_id
      }
    ],
    [
      {
        user_id: t.context.registration.admins[0]
      }
    ]
  );

  const invitations = await invitationModel.find({
    school_id: registeredSchool.id
  });

  t.is(invitations.length, 1, "admin invitation should exist");

  t.is(adminMembers.length, invitations.length, "should be the same length");

  const [email] = t.context.registration.admins;
  const adminInvitation = await invitationModel.findOne({
    email,
    school_id: registeredSchool.id
  });

  t.deepEqual(
    {
      from: adminInvitation.from,
      type: adminInvitation.type
    },
    {
      from: "pivot-api",
      type: "admin"
    }
  );
});

// test("/api/registry/register (trying to register the same school twice)", async t => {
//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(
//     response.status,
//     200,
//     "should return a status code of 200 for sucessfully inserting the school into the registry and adding inviting the admins to the school"
//   );

//   let registeredSchool = await registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.not(registeredSchool, null, "The school should be stored in the database");

//   const invitation = await invitationModel.find({
//     school_code: response.body.code
//   });
//   t.notDeepEqual(invitation, [], "This should not be a empty array");

//   const responseTwo = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (responseTwo.status !== 400) {
//     t.log(responseTwo.body);
//   }

//   t.is(
//     responseTwo.status,
//     400,
//     "should return a status code of 200 for sucessfully inserting the school into the registry and adding inviting the admins to the school"
//   );

//   t.deepEqual(responseTwo.body, {
//     school_code: response.body.code,
//     code: RegistryError.REGISTRATION_EXIST_EXCEPTION,
//     message: `'${
//       t.context.registration.school_name
//     }' is a already a registred school in the database registry`
//   });

//   const schoolCount = await db.registryModel
//     .find({
//       name: t.context.registration.school_name
//     })
//     .countDocuments();

//   t.is(schoolCount, 1, "Should only be one school under this this name");
// });

// test("/api/registry/register (sending invalid data)", async t => {
//   const requestBody = {
//     school_name: "",
//     domain: "gmail.com",
//     admins: [
//       {
//         name: "John Doe",
//         email: "johndoegmailcom"
//       },
//       {
//         email: `jane.doe@${t.context.registration.domain}`
//       }
//     ]
//   };
//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(requestBody);

//   if (response.status !== 400) {
//     t.log(response.body);
//   }

//   t.is(response.status, 400, "This should return a status code of 200");

//   t.deepEqual(response.body, {
//     code: VALIDATION_EXCEPTION,
//     message:
//       "There seems to be issue with the provided configure for registering",
//     errors: [
//       {
//         context: {
//           key: "domain"
//         },
//         message: "the domain must be a valid email domain"
//       },
//       {
//         context: {
//           key: "school_name"
//         },
//         message: "You must provide the name of the school you are registering"
//       },
//       {
//         context: {
//           key: "email",
//           parent_field: "admins",
//           pos: 0
//         },
//         message:
//           "The email of the admin is required and needs to be a valid email"
//       }
//     ]
//   });
// });

// test("/api/registry/register (providing a generic domain)", async t => {
//   t.context.registration.domain = "@gmail.com";

//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 400) {
//     t.log(response.body);
//   }

//   t.is(response.status, 400, "should return a status code of 400");

//   const { school_name, domain, admins } = t.context.registration;

//   t.deepEqual(response.body, {
//     code: RegistryError.DOMAIN_REGISTRATION_EXCEPTION,
//     message:
//       "The email domain that you have provided is not a private email domain or is open email domain."
//   });

//   const registeredSchool = await db.registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.is(registeredSchool, null, "The school should be stored in the database");
// });

// test("/api/registry/register (providing a domain, but some of the the admins email do not match the domain)", async t => {
//   t.context.registration.admins = [
//     {
//       email: "jane.doe@gmail.com",
//       name: "jane doe"
//     },
//     {
//       email: `jhondoe${t.context.registration.domain}`,
//       name: "john doe"
//     },
//     {
//       email: `jackdoe${t.context.registration.domain}`,
//       name: "jack doe"
//     },
//     {
//       email: "michealcera@scottpilgrimversetheworld.net",
//       name: "micheal cera"
//     }
//   ];

//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(response.status, 200, "should return a status code of 200");

//   t.truthy(
//     response.body.code,
//     "school code in the response body should not be falsey value"
//   );

//   t.truthy(
//     response.body.license_key,
//     "school license key in the response body should not be falsey value"
//   );

//   const registeredSchool = await db.registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.not(registeredSchool, null, "The school should be stored in the database");

//   const invitations = await db.invitationModel.find({
//     school_code: response.body.code
//   });
//   t.notDeepEqual(invitations, [], "This should not be a empty array");

//   delete response.body.code;
//   delete response.body.license_key;

//   t.deepEqual(response.body, {
//     domain: t.context.registration.domain,
//     school_name: t.context.registration.school_name,
//     admins: [
//       {
//         invited: false,
//         email: "jane.doe@gmail.com",
//         message:
//           "The user's email has been blocked for not match the same email domain as the school that your account is regiestered under"
//       },
//       { invited: true, email: `jhondoe${t.context.registration.domain}` },
//       { invited: true, email: `jackdoe${t.context.registration.domain}` },
//       {
//         invited: false,
//         email: "michealcera@scottpilgrimversetheworld.net",
//         message:
//           "The user's email has been blocked for not match the same email domain as the school that your account is regiestered under"
//       }
//     ]
//   });
// });

// test("/api/registry/register (providing a domain, but all of the the admins email do not match the domain)", async t => {
//   t.context.registration.admins = [
//     {
//       email: "jane.doe@gmail.com",
//       name: "jane doe"
//     },
//     {
//       email: `jhondoe@hotmail.com`,
//       name: "john doe"
//     },
//     {
//       email: `jackdoe@yahoo.com`,
//       name: "jack doe"
//     },
//     {
//       email: "michealcera@scottpilgrimversetheworld.net",
//       name: "micheal cera"
//     }
//   ];

//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 400) {
//     t.log(response.body);
//   }

//   t.is(response.status, 400, "should return a status code of 400");

//   const registeredSchool = await db.registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.is(registeredSchool, null, "The school should be stored in the database");

//   const invitation = await db.invitationModel.find({
//     school_code: response.body.code
//   });
//   t.deepEqual(invitation, [], "This should not be a empty array");

//   t.deepEqual(response.body, {
//     code: RegistryError.ADMIN_REGISTRATION_EXCEPTION,
//     message:
//       "It seems like all the admins you are registering for this school did not have a same email domain that was provided"
//   });
// });

// test("/api/registry/register (not providing a domain for the school)", async t => {
//   delete t.context.registration.domain;

//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(response.status, 200, "should return a status code of 200");

//   const registeredSchool = await db.registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.not(registeredSchool, null, "The school should be stored in the database");

//   const invitation = await db.invitationModel.find({
//     school_code: response.body.code
//   });
//   t.notDeepEqual(invitation, [], "This should not be a empty array");

//   response.body.admins = response.body.admins.map(admin => admin.invited);

//   t.deepEqual(response.body, {
//     domain: "",
//     admins: [true],
//     code: registeredSchool.code,
//     school_name: registeredSchool.name,
//     license_key: registeredSchool.license_key
//   });
// });

// test("/api/registry/register (adding the same admin twice)", async t => {
//   t.context.registration.admins.push({
//     email: `jane.doe${t.context.registration.domain}`,
//     name: "jane doe"
//   });

//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(response.status, 200, "should return a status code of 200");

//   t.is(
//     typeof response.body.code,
//     "string",
//     "school code in the response body should not be falsey value"
//   );

//   t.is(
//     typeof response.body.license_key,
//     "string",
//     "school license key in the response body should not be falsey value"
//   );

//   const registeredSchool = await db.registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.not(registeredSchool, null, "The school should be stored in the database");

//   const invitations = await db.invitationModel.find({
//     school_code: response.body.code
//   });
//   t.notDeepEqual(invitations, [], "This should not be a empty array");

//   t.is(invitations.length, 1, "Should only be one invitation created");

//   delete response.body.code;
//   delete response.body.license_key;

//   t.deepEqual(response.body, {
//     domain: t.context.registration.domain,
//     school_name: t.context.registration.school_name,
//     admins: [
//       {
//         invited: true,
//         email: `jane.doe${t.context.registration.domain}`
//       }
//     ]
//   });
// });

// test("/api/registry/authenticate/user (failed attempts for authenticating as a registry admin)", async t => {
//   t.plan(3);

//   const response = await request(app)
//     .post("/api/registry/authenticate")
//     .set("x-api-key", process.env.API_KEY)
//     .send({
//       email: "john.doe@kentro.co"
//     });

//   if (response.status !== 401) {
//     t.log(response.text);
//   }

//   t.is(response.status, 401);

//   const responseTwo = await request(app)
//     .post("/api/registry/authenticate")
//     .set("x-api-key", "FEFEFE")
//     .send({
//       email: "andre@kentro.co"
//     });

//   if (responseTwo.status !== 401) {
//     t.log(responseTwo.body);
//   }

//   t.is(responseTwo.status, 401);

//   const responseThree = await request(app)
//     .post("/api/registry/authenticate")
//     .set("x-api-key", process.env.API_KEY)
//     .send({
//       email: "john.doe@gmail.com"
//     });

//   if (responseThree.status !== 401) {
//     t.log(responseThree.body);
//   }

//   t.is(responseThree.status, 401);
// });

// test("/api/registry/authenticate/user", async t => {
//   const response = await request(app)
//     .post("/api/registry/authenticate")
//     .set("x-api-key", process.env.API_KEY)
//     .send({ email: "andre@kentro.co" });

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(response.status, 200);
// });

// test("/api/registry/register (authenticating as a white list user and creatign a school in the registry)", async t => {
//   const agent = await request.agent(app);

//   const authentication = await agent
//     .post("/api/registry/authenticate")
//     .set("x-api-key", process.env.API_KEY)
//     .send({ email: "andre@kentro.co" });

//   if (authentication.status !== 200) {
//     t.log(authentication.body);
//   }

//   t.is(authentication.status, 200, "Should return a status code of 200");

//   const response = await agent
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(
//     response.status,
//     200,
//     "should return a status code of 200 for sucessfully inserting the school into the registry and adding inviting the admins to the school"
//   );

//   const registeredSchool = await db.registryModel.findOne({
//     name: t.context.registration.school_name
//   });
//   t.not(registeredSchool, null, "The school should be stored in the database");

//   const invitations = await db.invitationModel.find({
//     school_code: response.body.code
//   });
//   t.not(invitations, [], "This should not be a empty array");

//   t.is(invitations[0].from, "kentro");

//   t.is(invitations[0].school_code, response.body.code);
// });

// test("/api/registry/search", async t => {
//   const agent = request.agent(app);

//   const response = await request(app)
//     .post("/api/registry/register")
//     .set("x-api-key", process.env.API_KEY)
//     .send(t.context.registration);

//   if (response.status !== 200) {
//     t.log(response.body);
//   }

//   t.is(response.status, 200, "should return status of 200");

//   const document = await db.registryModel.findOne({
//     domain: t.context.registration.domain
//   });
//   t.not(document, null, "document should exist");

//   const responseTwo = await agent.get("/api/registry/search");

//   if (responseTwo.status !== 200) {
//     t.log(responseTwo.body);
//   }

//   t.is(responseTwo.status, 200);

//   let schools = await db.registryModel.find({});
//   t.notDeepEqual(schools, [], "should not be a emoty array");

//   schools = schools.map(school => {
//     return {
//       name: school.name,
//       code: school.code,
//       domain: school.domain,
//       created_at: new Date(school.created_at).toISOString()
//     };
//   });

//   t.deepEqual(responseTwo.body, {
//     results: schools,
//     next_page: -1,
//     search: "",
//     limit: 15,
//     page: 1
//   });
// });
