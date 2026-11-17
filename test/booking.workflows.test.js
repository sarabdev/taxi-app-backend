import test from "node:test";
import assert from "node:assert/strict";
import { Booking } from "../src/modules/bookings/booking.model.js";
import { Driver } from "../src/modules/drivers/driver.model.js";
import { Partner } from "../src/modules/partners/partner.model.js";
import { Activity } from "../src/modules/activity/activity.model.js";
import { Notification } from "../src/modules/notifications/notification.service.js";
import { updateStatus, driverLinkAuth, getDriverLinkBooking, assignDriver } from "../src/modules/bookings/booking.controller.js";
import { partnerDashboard } from "../src/modules/partners/partner.dashboard.js";
import { signAccessLink } from "../src/utils/accessLinks.js";
import { env } from "../src/config/env.js";
import { queueBookingNotifications, recoverBookingNotifications } from "../src/modules/bookings/booking.notifications.js";
import { requestDashboardLink } from "../src/modules/partners/partner.dashboard.js";

env.JWT_SECRET = "test-only-workflow-secret";
const id = "507f1f77bcf86cd799439011";
const driverId = "507f1f77bcf86cd799439012";
const userId = "507f1f77bcf86cd799439013";
const partnerId = "507f1f77bcf86cd799439014";
const base = { _id: id, status: "ASSIGNED", completionCode: "1234", driverAmount: null,
  driverAccessNonce: "current", assignedDriverId: { _id: driverId, userId: { _id: userId, email: "driver@example.com" } },
  customerName: "PRIVATE CUSTOMER", customerEmail: "customer@example.com", customerPhone: "12345",
  pickupLocation: "Airport", dropoffLocation: "Hotel", pricing: { totalFare: 100 },
  partner: { partnerId, referralCode: "HOTEL-1234", commissionAmount: 10 } };
function query(data) {
  return { select() { return this; }, populate() { return this; }, sort() { return this; }, limit() { return this; },
    lean() { return Promise.resolve(data); }, then(resolve, reject) { return Promise.resolve(data).then(resolve, reject); } };
}
function response() { return { code: 200, body: null, set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
const driverRequest = (completionCode) => ({ user: { id: userId, role: "DRIVER" }, params: { id }, body: { status: "COMPLETED", completionCode } });

test("driver completion rejects another driver, cancelled rides, wrong codes and exhausted attempts", async (t) => {
  let current = base;
  let exhausted = false;
  let writes = 0;
  t.mock.method(Booking, "findById", () => query(current));
  t.mock.method(Booking, "findOneAndUpdate", (_filter, update) => {
    if (update.$inc) return query(exhausted ? null : { completionCodeAttempts: 1 });
    writes += 1; return query(null);
  });
  for (const scenario of [
    { booking: { ...base, assignedDriverId: { userId: { _id: "someone-else" } } }, code: "1234", expected: 403 },
    { booking: { ...base, status: "CANCELLED" }, code: "1234", expected: 409 },
    { booking: base, code: "9999", expected: 400 },
    { booking: base, code: "1234", expected: 423, exhausted: true },
  ]) {
    current = scenario.booking; exhausted = Boolean(scenario.exhausted);
    const res = response(); await updateStatus(driverRequest(scenario.code), res); assert.equal(res.code, scenario.expected);
  }
  assert.equal(writes, 0);
});

test("completion queues customer, driver, partner and both Zalt recipients once, with restricted driver response", async (t) => {
  let current = { ...base };
  const queued = [];
  t.mock.method(Booking, "findById", () => query(current));
  t.mock.method(Booking, "populate", async (booking) => booking);
  t.mock.method(Booking, "updateOne", async () => ({}));
  t.mock.method(Booking, "findOneAndUpdate", (_filter, update) => {
    if (update.$inc) return query({ completionCodeAttempts: 1 });
    current = { ...current, ...update.$set }; return query(current);
  });
  t.mock.method(Activity, "create", async () => ({}));
  t.mock.method(Partner, "findById", async () => ({ _id: partnerId, status: "APPROVED", companyName: "Hotel", email: "partner@example.com" }));
  t.mock.method(Notification, "updateOne", async (filter, update) => { queued.push(update.$setOnInsert); return {}; });
  const res = response(); await updateStatus(driverRequest("1234"), res);
  assert.equal(res.code, 200); assert.equal(res.body.status, "COMPLETED");
  assert.equal(res.body.pricing, undefined); assert.equal(res.body.completionCode, undefined); assert.equal(res.body.partner, undefined);
  assert.deepEqual(queued.map((mail) => mail.to).sort(), ["driver@example.com", "customer@example.com", "partner@example.com", "myairporttaxi86@gmail.com", "booking@zalt.uk"].sort());
  assert.ok(!queued.find((mail) => mail.to === "driver@example.com").html.includes('&pound;100.00'));
  const second = response(); await updateStatus(driverRequest("1234"), second);
  assert.equal(queued.length, 5); assert.equal(second.body.status, "COMPLETED");
});

test("ride links reject stale assignments and expose only the current assigned ride", async (t) => {
  t.mock.method(Booking, "findById", () => query({ ...base, assignedDriverId: driverId }));
  t.mock.method(Driver, "findById", () => query({ _id: driverId, isActive: true, userId: { _id: userId, isActive: true } }));
  for (const [nonce, expected] of [["old", 401], ["current", 200]]) {
    const token = signAccessLink("driver-completion", { sub: id, driverId, nonce });
    const req = { params: {}, headers: { authorization: `Bearer ${token}` } }; const res = response(); let next = false;
    await driverLinkAuth(req, res, () => { next = true; });
    assert.equal(res.code, expected); assert.equal(next, expected === 200);
    if (next) { getDriverLinkBooking(req, res); assert.equal(res.body._id, id); assert.equal(res.body.pricing, undefined); assert.equal(res.body.completionCode, undefined); }
  }
});

test("assignment stores nullable driver amount and queues a private completion link without the customer fare", async (t) => {
  let updated;
  const queued = [];
  t.mock.method(Driver, "findById", () => query({ _id: driverId, isActive: true, userId: { email: "driver@example.com" } }));
  t.mock.method(Booking, "findOneAndUpdate", (_filter, update) => { updated = { ...base, ...update.$set }; return query(updated); });
  t.mock.method(Booking, "findById", () => query({ ...updated, assignedDriverId: base.assignedDriverId }));
  t.mock.method(Booking, "populate", async (booking) => ({ ...booking, assignedDriverId: base.assignedDriverId }));
  t.mock.method(Booking, "updateOne", async () => ({}));
  t.mock.method(Activity, "create", async () => ({}));
  t.mock.method(Notification, "updateOne", async (_filter, update) => { queued.push(update.$setOnInsert); });
  for (const amount of [null, 25.5]) {
    const req = { params: { id }, user: { id: userId }, body: { driverId, driverAmount: amount } }; const res = response();
    await assignDriver(req, res); assert.equal(res.code, 200); assert.equal(updated.driverAmount, amount);
    const email = queued.at(-1); assert.match(email.html, /driver\/complete#token=/); assert.doesNotMatch(email.html, /&pound;100\.00/);
    if (amount != null) assert.match(email.html, /&pound;25\.50/);
  }
});

test("partner dashboard is scoped to its token and returns only totals and ride status", async (t) => {
  const partner = { _id: partnerId, companyName: "Hotel", email: "partner@example.com", status: "APPROVED" };
  t.mock.method(Partner, "findById", async () => partner);
  let bookingFilter;
  t.mock.method(Booking, "find", (filter) => { bookingFilter = filter; return query([{ ...base, status: "COMPLETED" }]); });
  t.mock.method(Booking, "aggregate", async () => [{ _id: { partnerId, status: "COMPLETED" }, count: 1, revenue: 100, commission: 10 }]);
  const token = signAccessLink("partner-dashboard", { sub: partnerId, email: partner.email });
  const res = response(); await partnerDashboard({ headers: { authorization: `Bearer ${token}` } }, res);
  assert.equal(bookingFilter["partner.partnerId"], partnerId);
  assert.equal(res.body.totalEarnings, 10); assert.equal(res.body.rides[0].status, "COMPLETED");
  assert.ok(!JSON.stringify(res.body).includes("PRIVATE CUSTOMER")); assert.ok(!JSON.stringify(res.body).includes("customer@example.com"));
  partner.status = "SUSPENDED";
  const denied = response(); await partnerDashboard({ headers: { authorization: `Bearer ${token}` } }, denied); assert.equal(denied.code, 401);
});

test("reassignment emails use the atomic assignment snapshot, never a later driver's details", async (t) => {
  let stored;
  let reads = 0;
  let mail;
  t.mock.method(Driver, "findById", () => query({ _id: driverId, isActive: true, userId: { email: "driver@example.com" } }));
  t.mock.method(Booking, "findOneAndUpdate", (_filter, update) => { stored = { ...base, ...update.$set }; return query(stored); });
  t.mock.method(Booking, "findById", () => { reads += 1; return query({ ...base, driverAmount: 99, assignedDriverId: { userId: { email: "other@example.com" } } }); });
  t.mock.method(Booking, "populate", async (snapshot) => ({ ...snapshot, assignedDriverId: base.assignedDriverId }));
  t.mock.method(Booking, "updateOne", async () => ({}));
  t.mock.method(Activity, "create", async () => ({}));
  t.mock.method(Notification, "updateOne", async (_filter, update) => { mail = update.$setOnInsert; });
  await assignDriver({ params: { id }, user: { id: userId }, body: { driverId, driverAmount: 25 } }, response());
  assert.equal(reads, 0); assert.equal(mail.to, "driver@example.com");
  assert.match(mail.html, /&pound;25\.00/); assert.doesNotMatch(mail.html, /&pound;99\.00/);
  assert.ok(stored["notificationPending.assignment"]);
});

test("completion cannot return a replacement driver's booking after a concurrent reassignment", async (t) => {
  let reads = 0;
  t.mock.method(Booking, "findById", () => query(++reads <= 2 ? base : { ...base, status: "COMPLETED", driverAmount: 99,
    assignedDriverId: { _id: "other-driver", userId: { _id: "other-user" } } }));
  t.mock.method(Booking, "findOneAndUpdate", (_filter, update) => query(update.$inc ? { completionCodeAttempts: 1 } : null));
  const res = response(); await updateStatus(driverRequest("1234"), res);
  assert.equal(res.code, 403); assert.equal(res.body.driverAmount, undefined);
});

test("interrupted email queue inserts keep delivery intent and recover missing recipients", async (t) => {
  const pending = { ...base, status: "COMPLETED", notificationPending: { completed: true } };
  const records = new Map();
  let fail = true;
  let cleared = 0;
  t.mock.method(console, "error", () => {});
  t.mock.method(Partner, "findById", async () => ({ _id: partnerId, status: "APPROVED", companyName: "Hotel", email: "partner@example.com" }));
  t.mock.method(Notification, "updateOne", async (filter, update) => {
    if (fail && update.$setOnInsert.to === "driver@example.com") throw new Error("Database unavailable");
    if (!records.has(filter.key)) records.set(filter.key, update.$setOnInsert);
  });
  t.mock.method(Booking, "updateOne", async () => { cleared += 1; });
  assert.equal(await queueBookingNotifications(pending, "completed"), false);
  assert.equal(cleared, 0); assert.equal(records.size, 4);
  fail = false;
  t.mock.method(Booking, "find", () => query([pending]));
  await recoverBookingNotifications();
  assert.equal(records.size, 5); assert.equal(cleared, 1);
});

test("failed dashboard-link queuing releases the cooldown so a partner can retry", async (t) => {
  const partner = { _id: partnerId, email: "partner@example.com", companyName: "Hotel" };
  let fail = true;
  let released = false;
  t.mock.method(Partner, "findOneAndUpdate", async () => partner);
  t.mock.method(Partner, "updateOne", async (filter, update) => { released = filter._id === partnerId && update.$set.dashboardEmailRequestedAt === null; });
  t.mock.method(Notification, "updateOne", async () => { if (fail) throw new Error("Database unavailable"); });
  await assert.rejects(requestDashboardLink({ body: { email: partner.email } }, response()), /Database unavailable/);
  assert.equal(released, true);
  fail = false;
  const res = response(); await requestDashboardLink({ body: { email: partner.email } }, res);
  assert.match(res.body.message, /dashboard link will arrive/);
});
