import test from "node:test";
import assert from "node:assert/strict";
import { partnerBookingEmail, partnerDashboardEmail } from "../src/emails/partnerBooking.js";

test("partner notifications identify code use and completion without leaking passenger data or fares", () => {
  const partner = { companyName: "Hotel <One>", referralCode: "HOTEL-1234" };
  const booking = { _id: "507f1f77bcf86cd799439011", status: "PENDING", customerName: "PRIVATE CUSTOMER",
    customerEmail: "secret@example.com", pickupLocation: "PRIVATE ADDRESS", pricing: { totalFare: 200 },
    partner: { referralCode: partner.referralCode, commissionAmount: 12.5 } };
  for (const completed of [false, true]) {
    const email = partnerBookingEmail({ partner, booking: { ...booking, status: completed ? "COMPLETED" : "PENDING" }, dashboardLink: "https://zalt.uk/partner/dashboard#token=secret", completed });
    assert.match(email.html, /HOTEL-1234/); assert.match(email.html, /&pound;12\.50/);
    assert.match(email.html, /View dashboard/); assert.match(email.html, /Hotel &lt;One&gt;/);
    assert.doesNotMatch(email.html, /PRIVATE CUSTOMER|secret@example.com|PRIVATE ADDRESS|&pound;200/);
    assert.match(email.subject, completed ? /Ride completed/ : /New referral booking/);
  }
  assert.match(partnerDashboardEmail({ partner, dashboardLink: "https://zalt.uk" }).html, /expires in 7 days/);
});
