import test from "node:test";
import assert from "node:assert/strict";
import {
  generateReferralCode,
  normalizeReferralCode,
  partnerCommissionAmount,
  referralLink,
} from "../src/modules/partners/partner.service.js";
import {
  adminCreatePartnerSchema,
  adminUpdatePartnerSchema,
  parseOrThrow,
  partnerApplicationSchema,
} from "../src/modules/partners/partner.validators.js";
import { partnerApprovedEmail } from "../src/emails/partnerApproved.js";
import {
  adminPartnerApplicationEmail,
  partnerApplicationReceivedEmail,
} from "../src/emails/partnerApplication.js";

const validApplication = {
  companyName: "The Grand Hotel",
  contactName: "Alex Smith",
  email: "Alex@Example.com ",
  propertyType: "HOTEL",
  propertyCount: "21-50",
};

test("referral codes use a readable company prefix and random suffix", () => {
  const code = generateReferralCode("The Grand Hotel & Spa", () => 0);
  assert.equal(code, "THEGRANDHO-2222");
  assert.match(generateReferralCode("Hôtel Côte"), /^HOTELCOTE-[2-9A-HJKMNP-Z]{4}$/);
});

test("referral codes fall back to PARTNER when the name has no letters", () => {
  assert.match(generateReferralCode("!!!"), /^PARTNER-[2-9A-HJKMNP-Z]{4}$/);
});

test("normalizes referral codes from links and typed input", () => {
  assert.equal(normalizeReferralCode(" grandhotel-7k2p "), "GRANDHOTEL-7K2P");
  assert.equal(normalizeReferralCode("abc<script>"), "ABCSCRIPT");
  assert.equal(normalizeReferralCode(undefined), "");
});

test("builds the partner link on the zalt.uk website", () => {
  assert.equal(referralLink("GRAND-7K2P"), "https://zalt.uk/?ref=GRAND-7K2P");
});

test("calculates partner commission as a rounded percentage of the fare", () => {
  assert.equal(partnerCommissionAmount(120, 10), 12);
  assert.equal(partnerCommissionAmount(99.99, 12.5), 12.5);
  assert.equal(partnerCommissionAmount(50, 0), 0);
  assert.equal(partnerCommissionAmount(-10, 10), 0);
  assert.equal(partnerCommissionAmount(100, 150), 100);
});

test("accepts a valid partner application and normalises the email", () => {
  const data = parseOrThrow(partnerApplicationSchema, validApplication);
  assert.equal(data.email, "alex@example.com");
  assert.equal(data.city, "");
});

test("rejects incomplete, invalid, and bot partner applications", () => {
  assert.throws(
    () => parseOrThrow(partnerApplicationSchema, { ...validApplication, companyName: " " }),
    /Property \/ company is required/
  );
  assert.throws(
    () => parseOrThrow(partnerApplicationSchema, { ...validApplication, email: "nope" }),
    /valid email/
  );
  assert.throws(
    () => parseOrThrow(partnerApplicationSchema, { ...validApplication, propertyType: "CASTLE" }),
    (error) => error.status === 400
  );
  assert.throws(
    () => parseOrThrow(partnerApplicationSchema, { ...validApplication, website: "spam.example" }),
    /Invalid submission/
  );
});

test("validates admin commission percentages", () => {
  const created = parseOrThrow(adminCreatePartnerSchema, {
    ...validApplication,
    commissionPercent: "12.345",
  });
  assert.equal(created.commissionPercent, 12.35);
  assert.equal(created.sendEmail, true);

  assert.throws(
    () => parseOrThrow(adminUpdatePartnerSchema, { commissionPercent: 101 }),
    /cannot exceed 100%/
  );
  assert.throws(
    () => parseOrThrow(adminUpdatePartnerSchema, { commissionPercent: -1 }),
    /cannot be negative/
  );
  assert.deepEqual(parseOrThrow(adminUpdatePartnerSchema, {}), {});
});

test("approval email contains the escaped link, code and commission", () => {
  const email = partnerApprovedEmail({
    partner: {
      contactName: "Alex <Admin>",
      companyName: "Grand & Co",
      referralCode: "GRAND-7K2P",
      commissionPercent: 12.5,
    },
    link: "https://example.test/?ref=GRAND-7K2P",
  });
  assert.match(email.html, /https:\/\/example\.test\/\?ref=GRAND-7K2P/);
  assert.match(email.html, /GRAND-7K2P/);
  assert.match(email.html, /12\.5%/);
  assert.match(email.html, /Alex &lt;Admin&gt;/);
  assert.match(email.html, /Grand &amp; Co/);
});

test("application emails reach the applicant and admin with escaped details", () => {
  const partner = {
    ...validApplication,
    companyName: "Grand <Hotel>",
    propertyType: "GUEST_HOUSE",
    message: "Hi <b>there</b>",
  };
  assert.match(partnerApplicationReceivedEmail({ partner }).html, /Grand &lt;Hotel&gt;/);

  const admin = adminPartnerApplicationEmail({ partner });
  assert.match(admin.subject, /Grand <Hotel>/);
  assert.match(admin.html, /Guest house \/ B&amp;B/);
  assert.match(admin.html, /Hi &lt;b&gt;there&lt;\/b&gt;/);
});
