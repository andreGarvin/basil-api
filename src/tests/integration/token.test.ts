import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";
import * as jwt from "jsonwebtoken";

const test = ava as TestInterface<{
  school: { id: string };
  user: { id: string; token: string };
}>;

// database helper functions
import * as db from "../helper";

// error codes
import AuthenticationError from "../../routes/authentication/error-codes";
import TokenError from "../../routes/authentication/token/error-codes";

import app from "../../index";
import { InvitationRoles } from "../../routes/invitation";

test.beforeEach(async t => {
  const generatedSchool = await db.createSchool();
  t.context.school = {
    id: generatedSchool.id
  };

  const user = await db.createUser({
    role: InvitationRoles.STUDENT,
    school_id: generatedSchool.id
  });

  t.context.user = {
    id: user.id,
    token: user.token
  };
});

test.afterEach.always(async t => {
  await db.clearRegistry();

  await db.clearUsers();
});

test("/auth/token/authenicate", async t => {
  const response = await request(app)
    .post("/auth/token/authenticate")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "Should be status code of 200");

  t.deepEqual(response.body, {
    user_id: t.context.user.id,
    school_id: t.context.school.id
  });
});

test("/auth/token/authenicate (providing a invalid token)", async t => {
  const response = await request(app)
    .post("/auth/token/authenticate")
    .set("x-token", `Bearer sajfjkdsajkdhjakshk`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "Should be status code of 400");

  t.deepEqual(response.body, {
    context: {},
    error_code: TokenError.INVALID_TOKEN_EXCEPTION,
    message: "The token that was provided is invalid"
  });
});

test("/auth/token/authenicate (providing a expired token)", async t => {
  const exipredToken = jwt.sign(
    { user_id: t.context.user.id, school_code: t.context.school.id },
    process.env.JSON_WEB_TOKEN_SECERT,
    {
      algorithm: "HS256",
      expiresIn: "1ms"
    }
  );

  await db.updateUserInfo(t.context.user.id, { token: exipredToken });

  const response = await request(app)
    .post("/auth/token/authenticate")
    .set("x-token", `Bearer ${exipredToken}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "Should be status code of 200");

  t.deepEqual(response.body, {
    context: {},
    message: "Token has exipred",
    error_code: TokenError.EXPIRED_TOKEN_EXCEPTION
  });
});

test("/auth/token/authenicate (providing a token with no existing account)", async t => {
  const token = jwt.sign(
    { user_id: "some-user-id", school_code: "some-school-code" },
    process.env.JSON_WEB_TOKEN_SECERT,
    {
      algorithm: "HS256",
      expiresIn: "30d"
    }
  );

  const response = await request(app)
    .post("/auth/token/authenticate")
    .set("x-token", `Bearer ${token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "Should be status code of 404");

  t.deepEqual(response.body, {
    context: {},
    message: "account does not exist",
    error_code: AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION
  });
});

test("/auth/token/refresh", async t => {
  const response = await request(app)
    .put("/auth/token/refresh")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return a status of 200");

  t.not(response.body.refreshed_token, t.context.user.token);

  t.deepEqual(
    { user_id: response.body.user_id, school_id: response.body.school_id },
    {
      user_id: t.context.user.id,
      school_id: t.context.school.id
    }
  );
});

test("/auth/token/refresh (refresh a token for a account that is deactivated)", async t => {
  await db.updateUserInfo(t.context.user.id, { deactivated: true });

  const response = await request(app)
    .put("/auth/token/refresh")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );
});

test("/auth/token/refresh (refresh a token for a account that is not verified)", async t => {
  await db.updateUserInfo(t.context.user.id, { verified: false });

  const response = await request(app)
    .put("/auth/token/refresh")
    .set("x-token", `Bearer ${t.context.user.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION
  );
});

// testing the token middleware
test("/auth/token/refresh (not sending a token)", async t => {
  const response = await request(app)
    .put("/auth/token/refresh")
    .set("x-token", "");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return a status of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/token/refresh (sending a invalid token)", async t => {
  const response = await request(app)
    .put("/auth/token/refresh")
    .set("x-token", "Bearer dasdsadsadsadsaddasd");

  t.is(response.status, 400, "should return a status of 400");

  t.is(response.body.error_code, TokenError.INVALID_TOKEN_EXCEPTION);
});

test("/auth/token/refresh (sending the wrong authorization type)", async t => {
  const response = await request(app)
    .put("/auth/token/refresh")
    .set("x-token", "Bear dasdsadsadsadsaddasd");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return a status of 400");

  t.is(
    response.body.error_code,
    AuthenticationError.INVALID_AUTHORIZATION_TYPE_EXCEPTION
  );
});
