import test from "node:test";
import assert from "node:assert/strict";
import { bookingConfirmedEmail } from "../src/emails/bookingConfirmed.js";
import { customerBookingCompletedEmail } from "../src/emails/customerBookingCompleted.js";
import { driverAssignedEmail } from "../src/emails/driverAssigned.js";
import { bookingCompletedEmail } from "../src/emails/bookingCompleted.js";
import { adminBookingConfirmedEmail } from "../src/emails/adminBookingConfirmed.js";
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
  assert.match(email.html, /&pound;50\.00/);
  assert.doesNotMatch(email.html, /Test <Customer>/);
});

test("admin confirmation contains escaped customer and paid total", () => {
  const email = adminBookingConfirmedEmail({ booking });
  assert.match(email.subject, /99439011/);
  assert.match(email.html, /Test &lt;Customer&gt;/);
  assert.match(email.html, /&pound;50\.00/);
});

test("driver assignment contains the journey and total fare", () => {
  const email = driverAssignedEmail({ booking });
  assert.match(email.subject, /99439011/);
  assert.match(email.html, /Airport/);
  assert.match(email.html, /&pound;50\.00/);
});

test("driver completion contains the 80% earning", () => {
  const email = bookingCompletedEmail({ booking, driverShare: 40 });
  assert.match(email.html, /&pound;40\.00/);
});

test("customer completion contains the journey and paid total", () => {
  const email = customerBookingCompletedEmail({ booking });
  assert.match(email.subject, /99439011/);
  assert.match(email.html, /Airport/);
  assert.match(email.html, /&pound;50\.00/);
});

test("admin completion contains driver and platform shares", () => {
  const email = adminBookingCompletedEmail({
    booking,
    driverShare: 40,
    platformShare: 10,
  });
  assert.match(email.html, /&pound;40\.00/);
  assert.match(email.html, /&pound;10\.00/);
});

test("all booking emails use the shared branded layout", () => {
  const emails = [
    bookingConfirmedEmail({ booking }),
    customerBookingCompletedEmail({ booking }),
    driverAssignedEmail({ booking }),
    bookingCompletedEmail({ booking, driverShare: 40 }),
    adminBookingConfirmedEmail({ booking }),
    adminBookingCompletedEmail({
      booking,
      driverShare: 40,
      platformShare: 10,
    }),
  ];

  for (const email of emails) {
    assert.match(email.html, /^<!doctype html>/);
    assert.match(email.html, /MYAIRPORT/);
    assert.match(email.html, /support@myairporttaxis\.uk/);
    assert.match(email.html, /max-width:620px/);
  }
});
