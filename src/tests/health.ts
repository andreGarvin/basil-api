import { test } from "ava";

import * as supertest from "supertest";

import app from "../index";

const request = supertest(app);

test("/health", async t => {
  const res = await request.get("/health");

  t.is(res.status, 200);

  t.deepEqual(res.body, { message: 'This service is "running"' });
});

test("/health?heavy=true", async t => {
  const res = await request.get("/health?heavy=true");

  t.is(res.status, 200);

  t.deepEqual(res.body, {
    message:
      "Service is still running and all queries have succesfully executed"
  });
});
