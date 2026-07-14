import test from "node:test";
import assert from "node:assert/strict";
import {
  driverShareForFare,
  platformShareForFare,
  roundMoney,
} from "../src/modules/accounting/accounting.service.js";

test("splits a completed fare into 80% driver and 20% platform shares", () => {
  assert.equal(driverShareForFare(100), 80);
  assert.equal(platformShareForFare(100), 20);
});

test("rounds each booking share to currency precision", () => {
  assert.equal(driverShareForFare(10.01), 8.01);
  assert.equal(platformShareForFare(10.01), 2);
});

test("discounted final fare is the only basis for earnings", () => {
  const discountedFare = 72.5;
  assert.equal(driverShareForFare(discountedFare), 58);
  assert.equal(platformShareForFare(discountedFare), 14.5);
});

test("invalid and negative amounts cannot create earnings", () => {
  assert.equal(roundMoney(undefined), 0);
  assert.equal(driverShareForFare(-10), 0);
  assert.equal(platformShareForFare(-10), 0);
});
