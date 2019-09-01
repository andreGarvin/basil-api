import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";

// invitation error codes
import AuthenticationError from "../../routes/authentication/error-codes";
import TokenError from "../../routes/authentication/token/error-codes";
import RegistryError from "../../routes/registry/error-codes";

// types
import { DecodedToken } from "../../routes/authentication/token/types";

// database helper functions
import * as db from "../helper";

interface Context {
  school: {
    id: string;
    name: string;
    domain: string;
  };
}
const test = ava as TestInterface<Context>;

// config
import {
  TOKEN_SECRET,
  TEMP_TOKEN_EXPIRATION,
  ValidationJsonResponse
} from "../../config";
const validationJsonResponse = ValidationJsonResponse();

import app from "../../index";
import { InvitationRoles } from "../../routes/invitation";

// before each test create user, school and pass the context to the all the test of the user and the school
test.beforeEach(async t => {
  // generated a new random school
  const generatedSchool = await db.createSchool();

  t.context.school = {
    id: generatedSchool.id,
    name: generatedSchool.name,
    domain: generatedSchool.domain
  };
});

test.afterEach.always(async t => {
  await db.clearInvitations();

  await db.clearRegistry();

  await db.clearUsers();
});

test("/auth/create (account defaults to student)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain
  );

  mockUser.password = "@Foobarb3z1";

  delete mockUser.role;

  const response = await request(app)
    .post("/auth/create")
    .send(mockUser);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 201, "should return status code of 201");

  // checking if the user account was created
  const account = await db.findUserByEmail(mockUser.email);

  t.is(account.email, mockUser.email, "email should match mock user email");

  t.false(account.verified, "the account should not be verified");

  const comparison = bcrypt.compareSync(mockUser.password, account.hash);

  t.true(comparison, "hash and password should match");

  t.is(
    `${account.first_name} ${account.last_name}`,
    `${mockUser.first_name} ${mockUser.last_name}`
  );

  t.is(
    account.role,
    InvitationRoles.STUDENT,
    "created user should have admin role"
  );

  t.not(
    account.token,
    undefined,
    "user token should exist under the user account"
  );

  const decoedToken = (await jwt.decode(account.token)) as DecodedToken;

  t.is(decoedToken.school_id, t.context.school.id, "same school id");

  t.is(decoedToken.user_id, account.id, "same user id");
});

test("/auth/create (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/create")
    .send({
      password: [],
      first_name: "",
      role: "SUPER_AMDIN",
      schoolCode: "sndi3uid9",
      email: "myemailissupercool"
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/auth/create (creating a admin account)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  user.password = "@Foobarb3z1";

  await db.createInvitation(user.email, user.role, t.context.school.id);

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 201, "should return status code of 201");

  // checking if the user account was created
  const account = await db.findUserByEmail(user.email);

  t.false(account.verified, "the account should not be verified");

  const comparison = bcrypt.compareSync(user.password, account.hash);

  t.true(comparison, "hash and password should match");

  t.is(
    `${account.first_name} ${account.last_name}`,
    `${user.first_name} ${user.last_name}`
  );

  t.is(account.role, user.role, "created user should have admin role");

  t.not(
    account.token,
    undefined,
    "user token should exist under the user account"
  );

  const decoedToken = (await jwt.decode(account.token)) as DecodedToken;

  t.is(decoedToken.school_id, t.context.school.id, "same school id");

  t.is(decoedToken.user_id, account.id, "same user id");
});

test("/auth/create (creating a professor account)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  user.password = "@Foobarb3z1";

  await db.createInvitation(user.email, user.role, t.context.school.id);

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 201, "should return status code of 201");

  // checking if the user account was created
  const account = await db.findUserByEmail(user.email);

  t.false(account.verified, "the account should not be verified");

  t.is(account.role, user.role, "created user should have admin role");
});

test("/auth/create (creating a professor account, but no professor invitation exist)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should not exist");

  t.is(response.body.error_code, AuthenticationError.USER_ROLE_EXCEPTION);
});

test("/auth/create (creating a professor account, but setting the role as a admin)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  await db.createInvitation(user.email, t.context.school.id, user.role);

  // changing the role of the user for creating a account
  user.role = "admin";

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should exist");

  t.is(response.body.error_code, AuthenticationError.USER_ROLE_EXCEPTION);
});

test("/auth/create (creating a student account, but setting the role as a admin)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  // changing the role of the user for creating a account
  user.role = "admin";

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should exist");

  t.is(response.body.error_code, AuthenticationError.USER_ROLE_EXCEPTION);
});

test("/auth/create (creating a account, but providing school name that does not exist)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  user.school_name = "undefined";

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should not exist");

  t.is(response.body.error_code, RegistryError.SCHOOL_NOT_FOUND_EXCEPTION);
});

test("/auth/create (creating a account, but the email that does not match the school domain email)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  await db.createInvitation(user.email, user.role, t.context.school.id);

  // changing the email of the admin to a non university email
  user.email = `${user.first_name}${user.last_name}@gmail.com`;

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should exist");

  t.is(response.body.error_code, RegistryError.DOMAIN_EXCEPTION);
});

test("/auth/create (creating a user account twice)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  user.password = "@FoodbarB4z1";

  await db.createInvitation(user.email, user.role, t.context.school.id);

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 201, "should return a status code of 201");

  const account = await db.findUserByEmail(user.email);

  t.not(account, null, "user account should exist");

  const responseTwo = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(responseTwo.status, 400, "should return a status code of 400");

  t.is(
    responseTwo.body.error_code,
    AuthenticationError.ACCOUNT_EXIST_EXCEPTION
  );
});

test("/auth/create (creating a account, but checking the password uniqueness)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  user.password = "some-weak-ass-password";

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should exist");

  t.is(response.body.error_code, AuthenticationError.UNIQUE_PASSWORD_EXCEPTION);
});

test("/auth/verify/:verification_id", async t => {
  const userAccount = await db.createUser({
    role: "admin",
    verified: false,
    school_id: t.context.school.id
  });

  // checking if the user accoutn was created
  let account = await db.findUserByEmail(userAccount.email);

  t.false(account.verified);

  const verificationToken = jwt.sign(
    {
      email: userAccount.email,
      school_id: userAccount.school_id
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const responseTwo = await request(app).get(
    `/auth/verify/${verificationToken}`
  );

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(
    responseTwo.status,
    302,
    "This should have redirect the user to the home page of the web page"
  );

  account = await db.findUserByEmail(userAccount.email);

  // checking if the user account was verified
  t.true(account.verified, "account should be verified");
});

test("/auth/verify/:verification_id (verifying account with a invaild temp verification token)", async t => {
  const userAccount = await db.createUser({
    role: "student",
    verified: false,
    school_id: t.context.school.id
  });

  const responseTwo = await request(app).get("/auth/verify/foobarbaz");

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(
    responseTwo.status,
    302,
    "This should have redirect the user to the home page of the web page"
  );

  const account = await db.findUserByEmail(userAccount.email);

  // checking if the user account was verified
  t.false(account.verified, "account should not be verified");
});

test("/auth/verify/:verification_id (verifying a account with a expired token)", async t => {
  const userAccount = await db.createUser({
    role: "admin",
    verified: false,
    school_id: t.context.school.id
  });

  const verificationToken = jwt.sign(
    {
      email: userAccount.email,
      school_id: userAccount.school_id
    },
    process.env.JSON_WEB_TOKEN_SECERT,
    {
      algorithm: "HS256",
      expiresIn: "1ms"
    }
  );

  const responseTwo = await request(app).get(
    `/auth/verify/${verificationToken}`
  );

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(
    responseTwo.status,
    302,
    "This should have redirect the user to the home page of the web page"
  );

  const account = await db.findUserByEmail(userAccount.email);

  // checking if the user account was verified
  t.false(account.verified, "account should not be verified");
});

test("/auth/send/verification", async t => {
  const userAccount = await db.createUser({
    verified: false,
    role: "professor",
    school_id: t.context.school.id
  });

  const response = await request(app)
    .post("/auth/send/verification")
    .send({
      email: userAccount.email
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return a status code of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/send/verification (sending invalid data)", async t => {
  const response = await request(app).post("/auth/send/verification");

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status code of 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/auth/send/verification (sending a email verification, but the user does not exist account)", async t => {
  const user = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );
  const responseTwo = await request(app)
    .post("/auth/send/verification")
    .send({ email: user.email });

  t.is(responseTwo.status, 200, "This should return a status code of 200");

  t.deepEqual(responseTwo.body, {
    sent: true
  });
});

test("/auth/send/verification (sending a email verification, but the user account is verified)", async t => {
  const userAccount = await db.createUser({
    role: "professor",
    school_id: t.context.school.id
  });

  const response = await request(app)
    .post("/auth/send/verification")
    .send({
      email: userAccount.email
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return a status code of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/send/verification (sending a email verification, but the user account has been deactivated)", async t => {
  const userAccount = await db.createUser({
    role: "professor",
    school_id: t.context.school.id
  });

  await db.updateUserInfo(userAccount.email, { deactivated: true });

  const response = await request(app)
    .post("/auth/send/verification")
    .send({
      email: userAccount.email
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return a status code of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/authenticate", async t => {
  const mockUserData = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  const newUser = await db.createUser(
    Object.assign(mockUserData, {
      verified: true,
      school_id: t.context.school.id
    })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUserData.email,
      password: mockUserData.password
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(
    response.body,
    {
      role: newUser.role,
      user_id: newUser.id,
      token: newUser.token,
      school_id: newUser.school_id
    },
    "This should return backa json body of the user credentail data"
  );
});

test("/auth/authenticate (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: "yea boi this is my email",
      password: true
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.deepEqual(response.body.error_code, validationJsonResponse.error_code);
});

test("/auth/authenticate (user account does not exist)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/authenticate (user password is incorrect)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  await db.createUser(
    Object.assign(mockUser, { school_id: t.context.school.id })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: "SOME_DANK_ASS_PASSWORD"
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 401");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/authenticate (user account is not verified)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  await db.createUser(
    Object.assign(mockUser, { school_id: t.context.school.id, verified: false })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION
  );
});

test("/auth/authenticate (user account is deactivated)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );
});

test("/auth/send/reset-password", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, { school_id: t.context.school.id, verified: true })
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({ email: newUser.email });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return back a status code of 200");

  const account = await db.findUserByEmail(newUser.email);

  // checking the user's account was deactivated
  t.true(account.deactivated, "The user account should be deactivated");

  t.deepEqual(response.body, { sent: true });

  const responseTwo = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(responseTwo.status, 401, "should return status code of 401");

  t.is(
    responseTwo.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );
});

test("/auth/send/reset-password (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({ email: "true" });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/auth/send/reset-password (sending reset password request, but one was already sent)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, { school_id: t.context.school.id, verified: true })
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: newUser.email
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return a status of 200");

  const responseTwo = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: newUser.email
    });

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(responseTwo.status, 200, "This should return a status of 200");

  t.deepEqual(responseTwo.body, { sent: true });
});

test("/auth/send/reset-password (sending reset password request, but account has not been verified)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "admin"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, { school_id: t.context.school.id, verified: false })
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: newUser.email
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status of 200");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION
  );
});

test("/auth/send/reset-password (sending reset password request, but account does not exist)", async t => {
  const mockeUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: mockeUser.email
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return a status of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/reactivate", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: newUser.email,
      school_id: newUser.school_id
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 401, "This should return a status of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );

  const responseTwo = await request(app).get(
    `/auth/reactivate?token=${TEMP_TOKEN}`
  );

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(responseTwo.status, 302, "This should return a status of 302");

  const account = await db.findUserByEmail(mockUser.email);

  t.false(account.deactivated, "The account should be deactivated");

  const responseThree = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(responseThree.body, null, 4));

  t.is(responseThree.status, 200, "This should return a status of 200");
});

test("/auth/reactivate (sending a invalid token)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const responseTwo = await request(app).get(
    "/auth/reactivate?token=nsdjinioed3isdisl"
  );

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(responseTwo.status, 302, "This should return a status of 302");

  let account = await db.findUserByEmail(mockUser.email);

  t.true(account.deactivated, "The account should be deactivated");
});

test("/auth/reactivate (providing no token)", async t => {
  const response = await request(app).get("/auth/reactivate");

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 302, "This should return a status of 302");
});

test("/auth/reset-password", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: newUser.email,
      school_id: newUser.school_id
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const NEW_PASSWORD = "Foo3@bazbar!";
  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: TEMP_TOKEN,
      new_password: NEW_PASSWORD
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "This should return a status of 200");

  let account = await db.findUserByEmail(mockUser.email);

  t.false(account.deactivated, "The account should not be deactivated");

  const responseTwo = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: NEW_PASSWORD
    });

  t.log(JSON.stringify(responseTwo.body, null, 4));

  t.is(responseTwo.status, 200, "This should return a status of 200");
});

test("/auth/reset-password (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/reset-password")
    .send({});

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  t.is(response.body.error_code, validationJsonResponse.error_code);
});

test("/auth/reset-password (the user's account has not been deactivated)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: false,
      school_id: t.context.school.id
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: newUser.email,
      school_id: newUser.school_id
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const NEW_PASSWORD = "Foo3@bazbar!";
  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: TEMP_TOKEN,
      new_password: NEW_PASSWORD
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status of 200");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_ACTIVATED_EXCEPTION
  );
});

test("/auth/reset-password (sending a invalid token)", async t => {
  const NEW_PASSWORD = "Foo3@bazbar!";
  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      new_password: NEW_PASSWORD,
      tmp_token: "blah-blah-blah"
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 401, "This should return a status of 200");

  t.is(response.body.error_code, TokenError.INVALID_TOKEN_EXCEPTION);
});

test("/auth/reset-password (reset password but sending the old password as the new password)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  mockUser.password = "@Foobarba3";

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: mockUser.email,
      school_id: t.context.school.id
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: TEMP_TOKEN,
      new_password: mockUser.password
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  const account = await db.findUserByEmail(mockUser.email);

  t.true(account.deactivated, "The account should be deactivated");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.UPDATE_PASSWORD_EXCEPTION
  );
});

test("/auth/reset-password (updating the password, however not passing the uniqueness checks)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "professor"
  );

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: mockUser.email,
      school_id: t.context.school.id
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: TEMP_TOKEN,
      new_password: "mockUser.password"
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  t.is(response.body.error_code, AuthenticationError.UNIQUE_PASSWORD_EXCEPTION);

  const account = await db.findUserByEmail(mockUser.email);

  t.true(account.deactivated, "The account should be deactivated");
});

test("/auth/reset-password (reseting password password for a account that does not exist)", async t => {
  const TEMP_TOKEN = jwt.sign(
    {
      email: "SOME_OTHER_RANDOM_BULLSHIT",
      school_id: "SOME_RANDOM_BULLSHIT"
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TEMP_TOKEN_EXPIRATION
    }
  );

  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: TEMP_TOKEN,
      new_password: "@FOOBARBA3"
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION
  );
});

test("/auth/reset-password (reseting password with a expired token)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const RANDOM_TOKEN = jwt.sign(
    {
      email: mockUser.email,
      school_id: t.context.school.id
    },
    TOKEN_SECRET,
    {
      expiresIn: "1ms", // making one millisecond to really make this efficient test case
      algorithm: "HS256"
    }
  );

  const NEW_PASSWORD = "Foo3@bazbar!";
  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: RANDOM_TOKEN,
      new_password: NEW_PASSWORD
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 401, "This should return a status of 401");

  t.deepEqual(response.body.error_code, TokenError.EXPIRED_TOKEN_EXCEPTION);
});

test("/auth/reset-password (reseting password with a token witha invalid signature)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true,
      school_id: t.context.school.id
    })
  );

  const RANDOM_TOKEN = jwt.sign(
    {
      email: mockUser.email,
      school_id: t.context.school.id
    },
    "YUMMY_TOKEN_SECRET",
    {
      expiresIn: "1ms", // making one millisecond to really make this efficient test case
      algorithm: "HS256"
    }
  );

  const NEW_PASSWORD = "Foo3@bazbar!";
  const response = await request(app)
    .post("/auth/reset-password")
    .send({
      tmp_token: RANDOM_TOKEN,
      new_password: NEW_PASSWORD
    });

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 401, "This should return a status of 401");

  t.deepEqual(response.body.error_code, TokenError.INVALID_TOKEN_EXCEPTION);
});

test("/auth/update-password", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: false,
      school_id: t.context.school.id
    })
  );

  const NEW_PASSWORD = "Foo3@bazbar!";
  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: NEW_PASSWORD,
      old_password: mockUser.password
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 200, "Shoudl return status code of 200");

  const user = await db.findUserByEmail(mockUser.email);

  t.true(bcrypt.compareSync(NEW_PASSWORD, user.hash));
});

test("/auth/update-password (updatinng password but setting the old password as the new password)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: false,
      school_id: t.context.school.id
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: mockUser.password,
      old_password: mockUser.password
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "Should return status code of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.NEW_PASSWORD_EXCEPTION
  );
});

test("/auth/update-password (updating password but the old passowrd is incorrect)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: false,
      school_id: t.context.school.id
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: "mockUser.password",
      old_password: "mockUser.password"
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "Should return status code of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/update-password (updating password while authenticated, but the new password does not pass uniqueness check)", async t => {
  const mockUser = db.createMockUserInfo(
    t.context.school.name,
    t.context.school.domain,
    "student"
  );

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: false,
      school_id: t.context.school.id
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: "NEW_PASSWORD",
      old_password: mockUser.password
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response.body, null, 4));

  t.is(response.status, 400, "Should return status code of 400");

  t.is(response.body.error_code, AuthenticationError.UNIQUE_PASSWORD_EXCEPTION);
});
