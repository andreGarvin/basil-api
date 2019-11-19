import * as path from "path";

import * as dotenv from "dotenv";
dotenv.config();

import ava, { TestInterface } from "ava";
import * as request from "supertest";

// error codes
import { VALIDATION_EXCEPTION, FileError } from "../../common/error-codes";
import UserError from "../../routes/user/error-codes";

// database helper functions
import * as db from "../helper";

// config
import { MIN_CHARACTER_LIMIT } from "../../config";

import app from "../../index";

interface Context {
  user: {
    id: string;
    token: string;
  };
}
const test = ava as TestInterface<Context>;

const SAMLPE_PROFILE_PHOTOS = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "profile_photos"
);

test.before(async t => {
  await db.clearBlockedUsers();
  await db.clearFollowers();
  await db.clearUsers();
});

test.beforeEach(async t => {
  const newUser = await db.createUser({
    verified: true
  });

  t.context.user = {
    id: newUser.id,
    token: `Bearer ${newUser.token}`
  };
});

test.afterEach.always(async t => {
  await db.clearBlockedUsers();
  await db.clearFollowers();
  await db.clearUsers();
});

test("/api/user/:user_id/profile/info", async t => {
  const response = await request(app)
    .get(`/api/user/${t.context.user.id}/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  // checking if the user account was created
  const account = await db.findUserById(t.context.user.id);

  t.deepEqual(response.body, {
    id: account.id,
    follower_count: 0,
    following_count: 0,
    username: account.username,
    photo_url: account.photo_url,
    description: account.description,
    display_name: account.display_name,
    created_at: new Date(account.created_at).toISOString(),
    meta: {
      blocked_user: false,
      is_following_user: false
    }
  });
});

test("/api/user/:user_id/profile/info (user does not exist)", async t => {
  const response = await request(app)
    .get(`/api/user/foobarbaz/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.deepEqual(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/profile/info (getting another user profile information)", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  const response = await request(app)
    .get(`/api/user/${newUser.id}/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  // checking if the user account was created
  const account = await db.findUserById(newUser.id);

  t.deepEqual(response.body, {
    id: account.id,
    follower_count: 0,
    following_count: 0,
    username: account.username,
    photo_url: account.photo_url,
    description: account.description,
    display_name: account.display_name,
    created_at: new Date(account.created_at).toISOString(),
    meta: {
      blocked_user: false,
      is_following_user: false
    }
  });
});

test("/api/user/:user_id/profile/info (getting another user profile information but the user account has been suspended)", async t => {
  const newUser = await db.createUser({
    verified: true,
    suspended: true
  });

  const response = await request(app)
    .get(`/api/user/${newUser.id}/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.is(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/profile/info (getting another user profile information but the user account has not been verified)", async t => {
  const newUser = await db.createUser({
    verified: false
  });

  const response = await request(app)
    .get(`/api/user/${newUser.id}/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.is(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/profile/info (getting another user profile information but the user requesting the information is blocked)", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(newUser.id, t.context.user.id);

  const response = await request(app)
    .get(`/api/user/${newUser.id}/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.is(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/profile/info (PATCH)", async t => {
  // old profile info
  const oldAccountInfo = await db.findUserById(t.context.user.id);

  const response = await request(app)
    .patch("/api/user/profile/info")
    .send({
      username: "anotherrandomchief",
      description: "I just wanted to create a new account"
    })
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  // checking if the user account was created
  const account = await db.findUserById(t.context.user.id);

  t.deepEqual(response.body, {
    gender: account.gender,
    username: account.username,
    description: account.description,
    display_name: account.display_name
  });

  t.not(account.username, oldAccountInfo.username);

  t.not(account.description, oldAccountInfo.description);
});

test("/api/user/profile/info (PATCH: sending invalid data)", async t => {
  const response = await request(app)
    .patch("/api/user/profile/info")
    .send({
      gender: 0, // this is not a joke
      display_name: [],
      username: "justanotherrandomaccountyoubigduffus",
      description: "new account ".repeat(MIN_CHARACTER_LIMIT + 1)
    })
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, VALIDATION_EXCEPTION);
});

test("/api/user/profile/info (PATCH: updating the user profile but leaving some field empty)", async t => {
  await db.updateUserInfo(t.context.user.id, {
    display_name: "mr.displayname",
    description: "I just wanted to create a new account"
  });

  const response = await request(app)
    .patch("/api/user/profile/info")
    .send({
      description: "",
      display_name: ""
    })
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  const account = await db.findUserById(t.context.user.id);

  t.is(account.description, "");

  t.is(account.display_name, "");
});

test("/api/user/profile/info (PATCH: updating the username of the profile but it all upper case)", async t => {
  const newUserName = "ALL.CAPS.BABY";

  const response = await request(app)
    .patch("/api/user/profile/info")
    .send({
      username: newUserName
    })
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  const account = await db.findUserById(t.context.user.id);

  t.not(account.username, newUserName);
});

test("/api/user/profile/info (PATCH: updating the username of the profile but adding a @ in the username)", async t => {
  const newUserName = "@all.ats.baby";

  const response = await request(app)
    .patch("/api/user/profile/info")
    .send({
      username: newUserName
    })
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, VALIDATION_EXCEPTION);

  const responseTwo = await request(app)
    .patch("/api/user/profile/info")
    .send({
      username: "all.ats.baby"
    })
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return status code of 200");
});

test("/api/user/profile/photo/upload", async t => {
  const SAMLPE_PROFILE_PHOTO = path.resolve(
    SAMLPE_PROFILE_PHOTOS,
    "sample_profile_photo.png"
  );

  const response = await request(app)
    .post("/api/user/profile/photo/upload")
    .attach("profile_photo", SAMLPE_PROFILE_PHOTO)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  const account = await db.findUserById(t.context.user.id);

  t.is(account.photo_url, `!${t.context.user.id}`);
});

test("/api/user/profile/photo/upload (uploading a fake image file)", async t => {
  const SAMLPE_PROFILE_PHOTO = path.resolve(
    SAMLPE_PROFILE_PHOTOS,
    "fake_image_file.jpeg"
  );

  const response = await request(app)
    .post("/api/user/profile/photo/upload")
    .attach("profile_photo", SAMLPE_PROFILE_PHOTO)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, FileError.INVALID_FILE_EXCEPTION);
});

test("/api/user/profile/photo/upload (setting a different field name in the multipart fileds)", async t => {
  const SAMLPE_PROFILE_PHOTO = path.resolve(
    SAMLPE_PROFILE_PHOTOS,
    "fake_image_file.jpeg"
  );

  const response = await request(app)
    .post("/api/user/profile/photo/upload")
    .attach("profile_pic", SAMLPE_PROFILE_PHOTO)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 400, "should return status code of 400");

  t.is(response.body.error_code, FileError.INVALID_FIELD_NAME_EXCEPTION);
});

test("/api/user/:user_id/block", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  const response = await request(app)
    .post(`/api/user/${newUser.id}/block`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(response.body, { blocked: true });

  const responseTwo = await request(app)
    .get(`/api/user/${t.context.user}/profile/info`)
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 404, "should return status code of 404");

  t.not(await db.findBlockedUser(t.context.user.id, newUser.id), null);
});

test("/api/user/:user_id/block (the user attempting to block a user that does not exist)", async t => {
  const response = await request(app)
    .post("/api/user/foobarbaz/block")
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.deepEqual(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/block (the user attempting to block themselves)", async t => {
  const response = await request(app)
    .post(`/api/user/${t.context.user.id}/block`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.deepEqual(response.body.error_code, UserError.ACTION_DENIDED_EXECPTION);
});

test("/api/user/:user_id/block (blocking a follower that user also follows)", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createFollower(newUser.id, t.context.user.id);
  await db.createFollower(t.context.user.id, newUser.id);

  const response = await request(app)
    .post(`/api/user/${newUser.id}/block`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(response.body, { blocked: true });

  const responseTwo = await request(app)
    .get(`/api/user/${t.context.user}/profile/info`)
    .set("x-token", `Bearer ${newUser.token}`);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 404, "should return status code of 404");

  t.not(await db.findBlockedUser(t.context.user.id, newUser.id), null);

  t.is(await db.findFollower(t.context.user.id, newUser.id), null);
});

test("/api/user/:user_id/block (blocking another user that has blocked the user)", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(newUser.id, t.context.user.id);

  const response = await request(app)
    .post(`/api/user/${newUser.id}/block`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.deepEqual(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/unblock", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(t.context.user.id, newUser.id);

  const response = await request(app)
    .delete(`/api/user/${newUser.id}/unblock`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(response.body, { unblocked: true });

  const responseTwo = await request(app)
    .get(`/api/user/${newUser.id}/profile/info`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return status code of 200");
});

test("/api/user/blocked", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(t.context.user.id, newUser.id);

  const response = await request(app)
    .get("/api/user/blocked")
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(response.body, {
    blocked_users: [
      {
        id: newUser.id,
        username: newUser.username,
        photo_url: newUser.photo_url,
        display_name: newUser.display_name
      }
    ]
  });
});

test("/api/user/:user_id/follow", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  const response = await request(app)
    .post(`/api/user/${newUser.id}/follow`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  const follower = await db.findFollower(t.context.user.id, newUser.id);

  t.log(follower);
  t.deepEqual(
    {
      user_id: follower.user_id,
      following_user_id: follower.following_user_id
    },
    {
      user_id: t.context.user.id,
      following_user_id: newUser.id
    }
  );
});

test("/api/user/:user_id/follow (a user attempting to follow themselves)", async t => {
  const response = await request(app)
    .post(`/api/user/${t.context.user.id}/follow`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 401, "should return status code of 401");

  t.is(response.body.error_code, UserError.ACTION_DENIDED_EXECPTION);
});

test("/api/user/:user_id/follow (a user attempting to follow user who blocked)", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(newUser.id, t.context.user.id);

  const response = await request(app)
    .post(`/api/user/${newUser.id}/follow`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.is(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/follow (a user attempting to follow user does not exist)", async t => {
  const response = await request(app)
    .post(`/api/user/foobarbaz/follow`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 404, "should return status code of 404");

  t.is(response.body.error_code, UserError.USER_NOT_FOUND_EXCEPTION);
});

test("/api/user/:user_id/unfollow", async t => {
  const newUser = await db.createUser({
    verified: true
  });

  await db.createFollower(newUser.id, t.context.user.id);

  const response = await request(app)
    .delete(`/api/user/${newUser.id}/unfollow`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.is(await db.findFollower(t.context.user.id, newUser.id), null);
});

test("/api/user/search (search filtering users that blocked the user searching)", async t => {
  const blockedUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(blockedUser.id, t.context.user.id);

  const response = await request(app)
    .get(`/api/user/search?search=${blockedUser.username}`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.is(response.body.result.length, 0);

  t.is(response.body.limit, 50);

  t.is(response.body.next_page, -1);
});

test("/api/user/search (search filtering users that the user blocked)", async t => {
  const blockedUser = await db.createUser({
    verified: true
  });

  await db.createBlockedUser(t.context.user.id, blockedUser.id);

  const response = await request(app)
    .get(`/api/user/search?search=${blockedUser.username}`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.is(response.body.result.length, 1);

  t.is(response.body.limit, 50);

  t.is(response.body.next_page, -1);
});

test("/api/user/search (filtering search of un verified accounts)", async t => {
  const blockedUser = await db.createUser();

  const response = await request(app)
    .get(`/api/user/search?search=${blockedUser.username}`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.is(response.body.result.length, 0);

  t.is(response.body.limit, 50);

  t.is(response.body.next_page, -1);
});

test("/api/user/search (sorting search by followed users)", async t => {
  const newUsers = await db.createUsers(5);

  const followedUser = newUsers[0];

  await db.createFollower(t.context.user.id, followedUser.id);

  const response = await request(app)
    .get("/api/user/search")
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  const result = response.body.result;
  t.is(result[0].id, followedUser.id);

  t.true(result[0].is_following_user);
});

test("/api/user/:user_id/profile/info/followers", async t => {
  const follower = await db.createUser({
    verified: true
  });

  await db.createFollower(follower.id, t.context.user.id);

  const response = await request(app)
    .get(`/api/user/${t.context.user.id}/profile/info/followers`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(response.body, {
    limit: 20,
    next_page: -1,
    result: [
      {
        id: follower.id,
        is_following_user: false,
        username: follower.username,
        photo_url: follower.photo_url,
        display_name: follower.display_name
      }
    ]
  });

  const responseTwo = await request(app)
    .get(`/api/user/${t.context.user.id}/profile/info/followers`)
    .set("x-token", `Bearer ${follower.token}`);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return status code of 200");

  t.deepEqual(responseTwo.body, {
    limit: 20,
    next_page: -1,
    result: [
      {
        id: follower.id,
        is_following_user: false,
        username: follower.username,
        photo_url: follower.photo_url,
        display_name: follower.display_name
      }
    ]
  });

  await db.createFollower(t.context.user.id, follower.id);

  const responseThree = await request(app)
    .get(`/api/user/${t.context.user.id}/profile/info/followers`)
    .set("x-token", t.context.user.token);

  t.log(JSON.stringify(responseThree, null, 4));

  t.is(responseThree.status, 200, "should return status code of 200");

  t.deepEqual(responseThree.body, {
    limit: 20,
    next_page: -1,
    result: [
      {
        id: follower.id,
        is_following_user: true,
        username: follower.username,
        photo_url: follower.photo_url,
        display_name: follower.display_name
      }
    ]
  });
});

test("/api/user/:user_id/profile/info/following", async t => {
  const newUsers = await db.createUsers(5);

  await Promise.all(
    newUsers.map(
      async user => await db.createFollower(t.context.user.id, user.id)
    )
  );

  const follower = newUsers[0];

  const response = await request(app)
    .get(`/api/user/${t.context.user.id}/profile/info/following`)
    .set("x-token", `Bearer ${follower.token}`);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(
    {
      limit: response.body.limit,
      next_page: response.body.next_page
    },
    {
      limit: 20,
      next_page: -1
    }
  );

  t.is(newUsers.length, response.body.result.length);
});

test("/api/user/:user_id/profile/info/following, checking if blocked user not see the user that blocked them on following aggregation", async t => {
  const userA = t.context.user;

  const userB = await db.createUser({
    verified: true
  });

  const userC = await db.createUser({
    verified: true
  });

  await db.createFollower(userA.id, userB.id);
  await db.createFollower(userB.id, userC.id);

  await db.createBlockedUser(userC.id, userA.id);

  const response = await request(app)
    .get(`/api/user/${userB}/profile/info/following`)
    .set("x-token", userA.token);

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200, "should return status code of 200");

  t.deepEqual(response.body, {
    limit: 20,
    result: [],
    next_page: -1
  });

  const responseTwo = await request(app)
    .get(`/api/user/${userB.id}/profile/info/following`)
    .set("x-token", `Bearer ${userB.token}`);

  t.log(JSON.stringify(responseTwo, null, 4));

  t.is(responseTwo.status, 200, "should return status code of 200");

  t.deepEqual(responseTwo.body, {
    limit: 20,
    next_page: -1,
    result: [
      {
        id: userC.id,
        is_following_user: false,
        username: userC.username,
        photo_url: userC.photo_url,
        display_name: userC.display_name
      }
    ]
  });
});
