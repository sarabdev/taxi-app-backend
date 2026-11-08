import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommissionChoice,
  commissionForFare,
} from "../src/modules/partners/partner.service.js";
import {
  adminCreatePartnerSchema,
  approvePartnerSchema,
  parseOrThrow,
} from "../src/modules/partners/partner.validators.js";
import { partnerApprovedEmail } from "../src/emails/partnerApproved.js";

test("fixed commission pays the same pounds whatever the fare, capped at the fare", () => {
  const fixed = { commissionType: "FIXED", commissionFixedAmount: 7.5 };
  assert.equal(commissionForFare(120, fixed), 7.5);
  assert.equal(commissionForFare(40, fixed), 7.5);
  assert.equal(commissionForFare(5, fixed), 5);
  assert.equal(commissionForFare(120, { commissionType: "PERCENT", commissionPercent: 10 }), 12);
  assert.equal(commissionForFare(120, { commissionPercent: 10 }), 12);
});

test("a fixed commission requires an amount", () => {
  const base = { companyName: "Grand", email: "a@example.com" };
  assert.throws(
    () => parseOrThrow(adminCreatePartnerSchema, { ...base, commissionType: "FIXED" }),
    /fixed £ commission/
  );
  const ok = parseOrThrow(adminCreatePartnerSchema, {
    ...base,
    commissionType: "FIXED",
    commissionFixedAmount: "5.555",
  });
  assert.equal(ok.commissionFixedAmount, 5.56);
  assert.throws(
    () => parseOrThrow(approvePartnerSchema, { commissionType: "FIXED", commissionFixedAmount: -1 }),
    /cannot be negative/
  );
});

test("switching type keeps the right values", async () => {
  const partner = { commissionType: "PERCENT", commissionPercent: 12, commissionFixedAmount: null };
  await applyCommissionChoice(partner, { commissionType: "FIXED", commissionFixedAmount: 5 });
  assert.equal(partner.commissionType, "FIXED");
  assert.equal(partner.commissionFixedAmount, 5);
  await applyCommissionChoice(partner, { commissionType: "PERCENT" });
  assert.equal(partner.commissionType, "PERCENT");
  assert.equal(partner.commissionPercent, 12);
  await assert.rejects(
    applyCommissionChoice({ commissionType: "PERCENT", commissionPercent: 10 }, { commissionType: "FIXED" }),
    /fixed £ commission/
  );
});

test("approval email shows a fixed commission in pounds", () => {
  const email = partnerApprovedEmail({
    partner: { companyName: "Grand", referralCode: "GRAND-7K2P", commissionType: "FIXED", commissionFixedAmount: 5 },
    link: "https://zalt.uk/?ref=GRAND-7K2P",
  });
  assert.match(email.html, /£5\.00/);
  assert.doesNotMatch(email.html, /% of the fare/);
});
