import test from "node:test";
import assert from "node:assert/strict";
import { bookingConfirmedEmail } from "../src/emails/bookingConfirmed.js";
import { bookingCompletedEmail } from "../src/emails/bookingCompleted.js";
import { adminBookingCompletedEmail } from "../src/emails/adminBookingCompleted.js";

const booking = {
  _id: "507f1f77bcf86cd799439011",
  customerName: "Test <Customer>",
  customerEmail: "customer@example.com",
  pickupLocation: "Airport",
  dropoffLocation: "City",
  pickupDate: "2026-07-20",
  pickupTime: "14:30",
  isReturnTrip: false,
  assignedDriverId: { name: "Driver One" },
  pricing: { totalFare: 50 },
};

test("customer confirmation contains reference, journey, and GBP total", () => {
  const email = bookingConfirmedEmail({ booking });
  assert.match(email.subject, /99439011/);
  assert.match(email.html, /Airport/);
  assert.match(email.html, /£50\.00/);
  assert.doesNotMatch(email.html, /Test <Customer>/);
});

test("driver completion contains the 80% earning", () => {
  const email = bookingCompletedEmail({ booking, driverShare: 40 });
  assert.match(email.html, /£40\.00/);
});

test("admin completion contains driver and platform shares", () => {
  const email = adminBookingCompletedEmail({
    booking,
    driverShare: 40,
    platformShare: 10,
  });
  assert.match(email.html, /£40\.00/);
  assert.match(email.html, /£10\.00/);
});
