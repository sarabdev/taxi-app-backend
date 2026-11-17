import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { signAccessLink, verifyAccessLink, partnerDashboardLink, driverCompletionLink } from "../src/utils/accessLinks.js";

env.JWT_SECRET = "test-only-access-secret-not-production";

test("email tokens are signed, expire and cannot be used for another role", () => {
  const token = signAccessLink("partner-dashboard", { sub: "partner-1", email: "partner@example.com" });
  assert.equal(verifyAccessLink(token, "partner-dashboard").sub, "partner-1");
  assert.throws(() => verifyAccessLink(token, "driver-completion"));
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ sub: "other" })).toString('base64url');
  assert.throws(() => verifyAccessLink(parts.join('.'), "partner-dashboard"));
  const expired = signAccessLink("partner-dashboard", { sub: "partner-1" }, -1);
  assert.throws(() => verifyAccessLink(expired, "partner-dashboard"));
  const normalLogin = jwt.sign({ sub: "admin", role: "ADMIN" }, env.JWT_SECRET);
  assert.throws(() => verifyAccessLink(normalLogin, "partner-dashboard"));
});

test("email links keep private tokens out of query strings and scope driver access to the assignment", () => {
  const partner = new URL(partnerDashboardLink({ _id: "p1", email: "p@example.com" }));
  assert.equal(partner.search, "");
  assert.ok(partner.hash.startsWith('#token='));
  const driver = new URL(driverCompletionLink({ _id: "ride", assignedDriverId: { _id: "driver" } }, "nonce"));
  const claims = verifyAccessLink(new URLSearchParams(driver.hash.slice(1)).get('token'), "driver-completion");
  assert.equal(claims.sub, "ride"); assert.equal(claims.driverId, "driver"); assert.equal(claims.nonce, "nonce");
});
