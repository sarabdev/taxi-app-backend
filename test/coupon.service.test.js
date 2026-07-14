import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCouponCode } from "../src/modules/coupons/coupon.service.js";

test("coupon codes are normalized consistently", () => {
  assert.equal(normalizeCouponCode("  save10  "), "SAVE10");
  assert.equal(normalizeCouponCode(null), "");
});
