import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchQuery,
  validateGuildPassword,
  validateUsername,
} from "../src/validation.js";

test("usernames accept safe display names", () => {
  assert.equal(validateUsername("Steady Player"), null);
  assert.equal(validateUsername("Player42"), null);
});

test("usernames reject delimiters, control characters, and surrounding space", () => {
  assert.match(validateUsername("player:name"), /only contain/);
  assert.match(validateUsername(" player"), /start or end/);
  assert.match(validateUsername("player\nname"), /only contain/);
  assert.match(validateUsername({}), /empty/);
});

test("guild passwords require a short string", () => {
  assert.equal(validateGuildPassword("secret"), null);
  assert.match(validateGuildPassword(""), /empty/);
  assert.match(validateGuildPassword("12345678901"), /10 characters/);
});

test("search queries are bounded and stripped of control characters", () => {
  assert.equal(normalizeSearchQuery("  steady\nplayer!*  "), "steadyplayer");
  assert.equal(normalizeSearchQuery("x".repeat(50)).length, 30);
  assert.equal(normalizeSearchQuery(null), "");
});
