import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  hashPassword,
  isSessionToken,
  verifyPassword,
} from "../src/security.js";

test("session tokens are random and valid", () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.equal(isSessionToken(first), true);
  assert.equal(isSessionToken(second), true);
  assert.notEqual(first, second);
  assert.equal(isSessionToken("e788ec28-ae88-11ec-a0af-2bcd3723a3e2"), false);
});

test("guild passwords are hashed and verified", async () => {
  const encoded = await hashPassword("steady123");

  assert.match(encoded, /^scrypt:/);
  assert.equal(encoded.includes("steady123"), false);
  assert.equal(await verifyPassword("steady123", encoded), true);
  assert.equal(await verifyPassword("wrong", encoded), false);
  assert.equal(await verifyPassword("steady123", "invalid"), false);
});
