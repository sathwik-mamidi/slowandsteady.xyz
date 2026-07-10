import test from "node:test";
import assert from "node:assert/strict";
import { calculateDonation, canDonate, donationProgress, nowSeconds } from "../src/game.js";

test("donations grow with elapsed time and reset-compatible player values", () => {
  const player = {
    wallet: "10",
    total_donated: "1",
    last_donated: String(nowSeconds() - 10),
  };

  assert.ok(calculateDonation(player) >= 10);
  assert.equal(canDonate(player), true);
  assert.equal(donationProgress(player), 1);
});

test("new players cannot donate immediately", () => {
  const player = {
    wallet: "0",
    total_donated: "1",
    last_donated: String(nowSeconds()),
  };

  assert.equal(calculateDonation(player), 0);
  assert.equal(canDonate(player), false);
  assert.equal(donationProgress(player), 0);
});
