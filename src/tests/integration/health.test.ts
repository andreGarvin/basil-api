import test from "ava";

import * as supertest from "supertest";

import app from "../../index";

const request = supertest(app);

test("/health", async t => {
  const response = await request.get("/health");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200);

  t.deepEqual(response.body, { message: 'This service is "running"' });
});

test("/health?heavy=true", async t => {
  const response = await request.get("/health?heavy=true");

  t.log(JSON.stringify(response, null, 4));

  t.is(response.status, 200);

  t.deepEqual(response.body, {
    message:
      "Service is still running and all queries have succesfully executed"
  });
});
