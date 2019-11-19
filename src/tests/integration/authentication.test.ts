import * as dotenv from "dotenv";
dotenv.config();

import test from "ava";

import * as request from "supertest";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";

// error codes
import AuthenticationError from "../../routes/authentication/error-codes";
import TokenError from "../../routes/authentication/token/error-codes";
import UserError from "../../routes/user/error-codes";

// types
import { DecodedToken } from "../../routes/authentication/token/types";

// database helper functions
import * as db from "../helper";

// config
import { TEMP_TOKEN_EXPIRATION, TOKEN_SECRET, ORG_DOMAIN } from "../../config";

import app from "../../index";
import { VALIDATION_EXCEPTION } from "../../common/error-codes";

test.before(async t => {
  await db.clearUsers();
});
test.afterEach.always(async t => {
  await db.clearUsers();
});

test("/auth/create", async t => {
  const mockUser = db.createMockUserInfo();

  mockUser.password = "@Foobarb3z1";

  const response = await request(app)
    .post("/auth/create")
    .send(mockUser);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 201, "should return status code of 201");

  // checking if the user account was created
  const account = await db.findUserByEmail(mockUser.email);

  t.not(
    account.username,
    account.username.toUpperCase(),
    "the username is has not uppercase characters"
  );

  t.is(account.email, mockUser.email, "email should match mock user email");

  t.false(account.verified, "the account should not be verified");

  const comparison = bcrypt.compareSync(mockUser.password, account.hash);

  t.true(comparison, "hash and password should match");

  t.is(account.display_name, mockUser.display_name);

  t.false(account.is_admin, "created user should not be a admin");

  t.not(
    account.token,
    undefined,
    "user token should exist under the user account"
  );

  const decoedToken = jwt.decode(account.token) as DecodedToken;

  t.is(decoedToken.email, account.email, "same user email");

  t.false(decoedToken.is_admin);
});

test("/auth/create (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/create")
    .send({
      password: [],
      first_name: "",
      username: 1234433,
      schoolCode: "sndi3uid9",
      email: "myemailissupercool"
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, VALIDATION_EXCEPTION);
});

test("/auth/create (a email with the basil domain)", async t => {
  const mockUser = db.createMockUserInfo();

  mockUser.password = "@Foobarb3z1";
  mockUser.email = `jondoe@${ORG_DOMAIN}`;

  const response = await request(app)
    .post("/auth/create")
    .send(mockUser);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 201, "should return status code of 201");

  // checking if the user account was created
  const account = await db.findUserByEmail(mockUser.email);

  t.true(account.is_admin, "created user should have admin account");
});

test("/auth/create (creating another account, but a google account exist)", async t => {
  const user = await db.createUser({
    password: "",
    is_google_account: true,
    email: "johndoe@gmail.com"
  });

  const response = await request(app)
    .post("/auth/create")
    .send({
      email: user.email,
      password: "@Foobarb3z1",
      username: user.username,
      display_name: user.display_name,
      date_of_birth: user.date_of_birth
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, AuthenticationError.ACCOUNT_EXIST_EXCEPTION);
});

test("/auth/create (creating a account, but the username is taken)", async t => {
  const user = await db.createUser();

  const mockeUser = db.createMockUserInfo();

  mockeUser.password = "@Foobarb3z1";
  mockeUser.username = user.username;

  const response = await request(app)
    .post("/auth/create")
    .send({
      email: mockeUser.email,
      password: mockeUser.password,
      username: mockeUser.username,
      display_name: mockeUser.display_name,
      date_of_birth: mockeUser.date_of_birth
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, UserError.USERNAME_EXIST_EXCEPTION);
});

test("/auth/create (creating a account, but failed password uniqueness)", async t => {
  const user = db.createMockUserInfo();

  user.password = "some-weak-ass-password";

  const response = await request(app)
    .post("/auth/create")
    .send(user);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  // checking if the user accoutn was created
  const account = await db.findUserByEmail(user.email);

  t.is(account, null, "user account should exist");

  t.is(response.body.error_code, AuthenticationError.UNIQUE_PASSWORD_EXCEPTION);
});

test("/auth/verify/:verification_id", async t => {
  const userAccount = await db.createUser({
    verified: false
  });

  // checking if the user accoutn was created
  let account = await db.findUserByEmail(userAccount.email);

  t.false(account.verified);

  const verificationToken = jwt.sign(
    {
      email: userAccount.email
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

  t.log(JSON.stringify(responseTwo, null, 4));

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
    verified: false
  });

  const responseTwo = await request(app).get("/auth/verify/foobarbaz");

  t.log(JSON.stringify(responseTwo, null, 4));

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
    verified: false
  });

  const verificationToken = jwt.sign(
    {
      email: userAccount.email
    },
    TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1ms"
    }
  );

  const responseTwo = await request(app).get(
    `/auth/verify/${verificationToken}`
  );

  t.log(JSON.stringify(responseTwo, null, 4));

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
    verified: false
  });

  const response = await request(app)
    .post("/auth/send/verification")
    .send({
      email: userAccount.email
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "This should return a status code of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/send/verification (sending invalid data)", async t => {
  const response = await request(app).post("/auth/send/verification");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status code of 400");

  t.is(response.body.error_code, VALIDATION_EXCEPTION);
});

test("/auth/send/verification (sending a email verification, but the user does not exist account)", async t => {
  const [randomEmail] = db.generateRandomUserEmails(1);

  const responseTwo = await request(app)
    .post("/auth/send/verification")
    .send({ email: randomEmail });

  t.is(responseTwo.status, 200, "This should return a status code of 200");

  t.deepEqual(responseTwo.body, {
    sent: true
  });
});

test("/auth/send/verification (sending a email verification, but the user account is verified)", async t => {
  const userAccount = await db.createUser();

  const response = await request(app)
    .post("/auth/send/verification")
    .send({
      email: userAccount.email
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "This should return a status code of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/send/verification (sending a email verification, but the user account has been deactivated)", async t => {
  const userAccount = await db.createUser();

  await db.updateUserInfo(userAccount.email, { deactivated: true });

  const response = await request(app)
    .post("/auth/send/verification")
    .send({
      email: userAccount.email
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "This should return a status code of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/authenticate", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, { verified: true })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: newUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(
    response.body,
    {
      user_id: newUser.id,
      email: newUser.email,
      token: newUser.token,
      is_admin: newUser.is_admin
    },
    "This should return backa json body of the user credentail data"
  );
});

test("/auth/authenticate (attempting to login but the user account has been suspended)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, { verified: true, suspended: true })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: newUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_SUSPENDED_EXCEPTION
  );
});

test("/auth/authenticate (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: "yea boi this is my email",
      password: true
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.deepEqual(response.body.error_code, VALIDATION_EXCEPTION);
});

test("/auth/authenticate (user account does not exist)", async t => {
  const mockUser = db.createMockUserInfo();

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/authenticate (user password is incorrect)", async t => {
  const newUser = await db.createUser();

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: newUser.email,
      password: "SOME_DANK_ASS_PASSWORD"
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/authenticate (user account is not verified)", async t => {
  const mockUser = db.createMockUserInfo();

  await db.createUser(Object.assign(mockUser, { verified: false }));

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION
  );
});

test("/auth/authenticate (user account is deactivated)", async t => {
  const mockUser = db.createMockUserInfo();

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const response = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );
});

test("/auth/send/reset-password", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, { verified: true })
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({ email: newUser.email });

  t.log(JSON.stringify(response, null, 4));

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

  t.log(JSON.stringify(responseTwo, null, 4));

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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, VALIDATION_EXCEPTION);
});

test("/auth/send/reset-password (sending reset password request, but one was already sent)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, { verified: true })
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: newUser.email
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "This should return a status of 200");

  const responseTwo = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: newUser.email
    });

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "This should return a status of 200");

  t.deepEqual(responseTwo.body, { sent: true });
});

test("/auth/send/reset-password (sending reset password request, but account has not been verified)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, { verified: false })
  );

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: newUser.email
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status of 200");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_VERIFICATION_EXCEPTION
  );
});

test("/auth/send/reset-password (sending reset password request, but account does not exist)", async t => {
  const mockeUser = db.createMockUserInfo();

  const response = await request(app)
    .post("/auth/send/reset-password")
    .send({
      email: mockeUser.email
    });

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "This should return a status of 200");

  t.deepEqual(response.body, { sent: true });
});

test("/auth/reactivate", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: newUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "This should return a status of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );

  const responseTwo = await request(app).get(
    `/auth/reactivate?token=${TEMP_TOKEN}`
  );

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 302, "This should return a status of 302");

  const account = await db.findUserByEmail(mockUser.email);

  t.false(account.deactivated, "The account should be deactivated");

  const responseThree = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: mockUser.password
    });

  t.log(JSON.stringify(responseThree, null, 4));

  t.is(responseThree.status, 200, "This should return a status of 200");
});

test("/auth/reactivate (sending a invalid token)", async t => {
  const mockUser = db.createMockUserInfo();

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const responseTwo = await request(app).get(
    "/auth/reactivate?token=nsdjinioed3isdisl"
  );

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 302, "This should return a status of 302");

  let account = await db.findUserByEmail(mockUser.email);

  t.true(account.deactivated, "The account should be deactivated");
});

test("/auth/reactivate (providing no temporary reste password token)", async t => {
  const response = await request(app).get("/auth/reactivate");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 302, "This should return a status of 302");
});

test("/auth/reset-password", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: newUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "This should return a status of 200");

  let account = await db.findUserByEmail(mockUser.email);

  t.false(account.deactivated, "The account should not be deactivated");

  const responseTwo = await request(app)
    .post("/auth/authenticate")
    .send({
      email: mockUser.email,
      password: NEW_PASSWORD
    });

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "This should return a status of 200");
});

test("/auth/reset-password (sending invalid data)", async t => {
  const response = await request(app)
    .post("/auth/reset-password")
    .send({});

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  t.is(response.body.error_code, VALIDATION_EXCEPTION);
});

test("/auth/reset-password (reseting a user account but the user's account has not been deactivated)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: false
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: newUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "This should return a status of 200");

  t.is(response.body.error_code, TokenError.INVALID_TOKEN_EXCEPTION);
});

test("/auth/reset-password (reseting user password but, sending the old password as the new password)", async t => {
  const mockUser = db.createMockUserInfo();

  mockUser.password = "@Foobarba3";

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: mockUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  const account = await db.findUserByEmail(mockUser.email);

  t.true(account.deactivated, "The account should be deactivated");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.UPDATE_PASSWORD_EXCEPTION
  );
});

test("/auth/reset-password (updating the password, however not passing the uniqueness checks)", async t => {
  const mockUser = db.createMockUserInfo();

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const TEMP_TOKEN = jwt.sign(
    {
      email: mockUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  t.is(response.body.error_code, AuthenticationError.UNIQUE_PASSWORD_EXCEPTION);

  const account = await db.findUserByEmail(mockUser.email);

  t.true(account.deactivated, "The account should be deactivated");
});

test("/auth/reset-password (reseting password password for a account that does not exist)", async t => {
  const TEMP_TOKEN = jwt.sign(
    {
      email: "SOME_OTHER_RANDOM_BULLSHIT"
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "This should return a status of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.ACCOUNT_NOT_FOUND_EXCEPTION
  );
});

test("/auth/reset-password (reseting password with a expired token)", async t => {
  const mockUser = db.createMockUserInfo();

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const RANDOM_TOKEN = jwt.sign(
    {
      email: mockUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "This should return a status of 401");

  t.deepEqual(response.body.error_code, TokenError.EXPIRED_TOKEN_EXCEPTION);
});

test("/auth/reset-password (reseting password with a token witha invalid signature)", async t => {
  const mockUser = db.createMockUserInfo();

  await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const RANDOM_TOKEN = jwt.sign(
    {
      email: mockUser.email
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "This should return a status of 401");

  t.deepEqual(response.body.error_code, TokenError.INVALID_TOKEN_EXCEPTION);
});

test("/auth/update-password", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true
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

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "Shoudl return status code of 200");

  const user = await db.findUserByEmail(mockUser.email);

  t.true(bcrypt.compareSync(NEW_PASSWORD, user.hash));
});

test("/auth/update-password (updatinng password but, setting the old password as the new password)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: mockUser.password,
      old_password: mockUser.password
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "Should return status code of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.NEW_PASSWORD_EXCEPTION
  );
});

test("/auth/update-password (updating password but, the old passowrd is incorrect)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: "mockUser.password",
      old_password: "mockUser.password"
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "Should return status code of 400");

  t.deepEqual(
    response.body.error_code,
    AuthenticationError.FAILED_AUTHENTICATION_EXCEPTION
  );
});

test("/auth/update-password (updating password while authenticated, but the new password does not pass uniqueness check)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: "NEW_PASSWORD",
      old_password: mockUser.password
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "Should return status code of 400");

  t.is(response.body.error_code, AuthenticationError.UNIQUE_PASSWORD_EXCEPTION);
});

test("/auth/update-password (updating password while authenticated, but the user accoutnt has been deactivated)", async t => {
  const mockUser = db.createMockUserInfo();

  const newUser = await db.createUser(
    Object.assign(mockUser, {
      verified: true,
      deactivated: true
    })
  );

  const response = await request(app)
    .put("/auth/update-password")
    .send({
      new_password: "NEW_PASSWORD",
      old_password: mockUser.password
    })
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "Should return status code of 401");

  t.is(
    response.body.error_code,
    AuthenticationError.ACCOUNT_DEACTIVATED_EXCEPTION
  );
});
