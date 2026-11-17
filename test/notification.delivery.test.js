import test from "node:test";
import assert from "node:assert/strict";
import { Notification, deliverPendingEmails, queueEmail } from "../src/modules/notifications/notification.service.js";

test("mail delivery preserves failed messages for retry and marks SMTP acceptance as sent", async (t) => {
  let next;
  const updates = [];
  const leases = [];
  t.mock.method(Notification, "updateMany", async () => ({}));
  t.mock.method(Notification, "findOneAndUpdate", async () => { const result = next; next = null; return result; });
  t.mock.method(Notification, "updateOne", async (filter, update) => { updates.push(update.$set); leases.push(filter.leaseToken); });
  const message = { _id: "notification", to: "partner@example.com", subject: "Ride", html: "body", attempts: 1 };
  next = message;
  await deliverPendingEmails({ send: async () => ({ sent: false }) });
  assert.equal(updates[0].status, "PENDING"); assert.ok(updates[0].nextAttemptAt > new Date());
  next = { ...message, attempts: 2 };
  await deliverPendingEmails({ send: async () => ({ sent: true }) });
  assert.equal(updates[1].status, "SENT");
  next = { ...message, attempts: 8 };
  await deliverPendingEmails({ send: async () => { throw new Error("SMTP offline"); } });
  assert.equal(updates[2].status, "FAILED");
  assert.equal(new Set(leases).size, 3);
  assert.ok(leases.every((lease) => typeof lease === "string" && lease.length > 20));
});

test("queue uses one stable upsert key per event and recipient", async (t) => {
  const calls = [];
  t.mock.method(Notification, "updateOne", async (...args) => { calls.push(args); });
  await queueEmail("ride:confirmed", ["Partner@Example.com", "booking@zalt.uk"], { subject: "Ride", html: "body" });
  assert.equal(calls[0][0].key, "ride:confirmed:partner@example.com");
  assert.equal(calls[0][2].upsert, true);
  assert.equal(calls[1][0].key, "ride:confirmed:booking@zalt.uk");
});
