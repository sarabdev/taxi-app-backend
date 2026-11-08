import test from "node:test";
import assert from "node:assert/strict";
import {
  completionCodeMatches,
  generateCompletionCode,
  normalizeCompletionCode,
} from "../src/modules/bookings/completionCode.js";
import { bookingConfirmedEmail } from "../src/emails/bookingConfirmed.js";
import { Booking } from "../src/modules/bookings/booking.model.js";

test("job-end codes are always 4 digits", () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(generateCompletionCode(), /^\d{4}$/);
  }
});

test("job-end code check accepts only the exact code", () => {
  assert.equal(completionCodeMatches("0427", "0427"), true);
  assert.equal(completionCodeMatches("0427", " 04-27 "), true);
  assert.equal(completionCodeMatches("0427", "0428"), false);
  assert.equal(completionCodeMatches("0427", "427"), false);
  assert.equal(completionCodeMatches("0427", ""), false);
  assert.equal(completionCodeMatches("", ""), false);
  assert.equal(normalizeCompletionCode("12a34567"), "1234");
});

test("job-end code is hidden from booking queries by default", () => {
  assert.equal(Booking.schema.path("completionCode").options.select, false);
  assert.equal(Booking.schema.path("completionCodeAttempts").options.select, false);
});

test("customer confirmation email shows the job-end code", () => {
  const booking = {
    _id: "64b7f0c2a1b2c3d4e5f60718",
    customerName: "Sam",
    completionCode: "0427",
    pickupLocation: "Airport",
    dropoffLocation: "City",
    luggage: {},
    flight: {},
    pricing: { totalFare: 50 },
  };
  assert.match(bookingConfirmedEmail({ booking }).html, /job-end code[\s\S]*0427/i);
  const { completionCode: _c, ...withoutCode } = booking;
  assert.doesNotMatch(bookingConfirmedEmail({ booking: withoutCode }).html, /job-end code/i);
});
