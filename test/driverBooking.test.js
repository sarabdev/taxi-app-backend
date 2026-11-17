import test from "node:test";
import assert from "node:assert/strict";
import { driverBooking, parseDriverAmount } from "../src/modules/bookings/driverBooking.js";
import { driverEarningsForBooking, getDriverAccounting } from "../src/modules/accounting/accounting.service.js";
import { Booking } from "../src/modules/bookings/booking.model.js";
import { Payout } from "../src/modules/payouts/payout.model.js";

test("driver responses never expose fare, partner commission, vehicle prices, payment or job-end secrets", () => {
  const visible = driverBooking({ _id: "ride", status: "ASSIGNED", pickupLocation: "Airport", driverAmount: null,
    completionCode: "1234", driverAccessNonce: "private", completionCodeAttempts: 2,
    pricing: { totalFare: 100 }, partner: { commissionAmount: 10 }, paymentIntentId: "secret",
    carId: { name: "Saloon", pricePerMile: 4, airportPricingBands: [1] } });
  assert.deepEqual(visible, { _id: "ride", status: "ASSIGNED", pickupLocation: "Airport", driverAmount: null,
    carId: { name: "Saloon" }, requiresCompletionCode: true });
  assert.equal(driverBooking({ driverAmount: 0 }).driverAmount, 0);
});

test("optional driver amounts support blank, zero and exact GBP, rejecting invalid values", () => {
  for (const blank of [null, undefined, ""]) assert.equal(parseDriverAmount(blank), null);
  assert.equal(parseDriverAmount("25.50"), 25.5);
  assert.equal(parseDriverAmount(0), 0);
  for (const bad of [-1, "oops", Infinity, true, {}, [], " ", 1.001]) assert.throws(() => parseDriverAmount(bad));
});

test("agreed driver amounts override internal accounting without rewriting legacy earnings", () => {
  assert.equal(driverEarningsForBooking({ driverAmount: 25.5, pricing: { totalFare: 100 } }), 25.5);
  assert.equal(driverEarningsForBooking({ driverAmount: 0, pricing: { totalFare: 100 } }), 0);
  assert.equal(driverEarningsForBooking({ pricing: { totalFare: 100 } }), 80);
});

test("driver wallet excludes automatic earnings and withholds an incomplete balance while internal accounting stays intact", async (t) => {
  const earnings = [{ driverAmount: null, pricing: { totalFare: 100 } }, { driverAmount: 25, pricing: { totalFare: 100 } }];
  const query = (value) => ({ select() { return this; }, lean: async () => value });
  t.mock.method(Booking, "find", () => query(earnings));
  t.mock.method(Payout, "find", () => query([{ amount: 10 }]));
  const id = "507f1f77bcf86cd799439011";
  const internal = await getDriverAccounting(id);
  assert.equal(internal.earned, 105); assert.equal(internal.balance, 95);
  const visible = await getDriverAccounting(id, { visibleOnly: true });
  assert.equal(visible.earned, 25); assert.equal(visible.balance, null);
  earnings.shift();
  const fullyAgreed = await getDriverAccounting(id, { visibleOnly: true });
  assert.equal(fullyAgreed.balance, 15);
});
