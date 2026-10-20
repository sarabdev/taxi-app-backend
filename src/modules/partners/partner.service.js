import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import { Partner } from "./partner.model.js";
import { Booking } from "../bookings/booking.model.js";
import { roundMoney } from "../accounting/accounting.service.js";
import { getSettings } from "../settings/settings.service.js";
import { sendMail } from "../../utils/mailer.js";
import { partnerApprovedEmail } from "../../emails/partnerApproved.js";

// Unambiguous characters only (no 0/O, 1/I/L) so codes survive being read aloud
// or typed from a printed card.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_SUFFIX_LENGTH = 4;
const CODE_PREFIX_MAX = 10;
const MAX_CODE_ATTEMPTS = 10;

export const DEFAULT_PARTNER_COMMISSION_PERCENT = 10;

// Public website that partner referral links point to.
export const WEBSITE_URL = "https://zalt.uk";

/** Normalises user input into the stored referral code format. */
export function normalizeReferralCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

/**
 * A readable, unique-enough code such as "GRANDHOTEL-7K2P": a prefix from the
 * company name plus a random suffix. Uniqueness is enforced by the database.
 */
export function generateReferralCode(companyName, random = randomInt) {
  const prefix =
    String(companyName || "")
      .normalize("NFKD")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, CODE_PREFIX_MAX) || "PARTNER";
  let suffix = "";
  for (let i = 0; i < CODE_SUFFIX_LENGTH; i += 1) {
    suffix += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

export function referralLink(referralCode) {
  return `${WEBSITE_URL}/?ref=${encodeURIComponent(referralCode)}`;
}

export function partnerCommissionAmount(totalFare, commissionPercent) {
  const fare = Math.max(0, Number(totalFare) || 0);
  const percent = Math.min(100, Math.max(0, Number(commissionPercent) || 0));
  return roundMoney((fare * percent) / 100);
}

export async function getDefaultCommissionPercent() {
  const settings = await getSettings();
  const value = Number(settings.defaultPartnerCommissionPercent);
  return Number.isFinite(value) ? value : DEFAULT_PARTNER_COMMISSION_PERCENT;
}

async function assignUniqueReferralCode(partner) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateReferralCode(partner.companyName);
    if (!(await Partner.exists({ referralCode: code }))) return code;
  }
  throw new Error("Could not generate a unique referral code. Please try again.");
}

/**
 * Approves (or re-activates) a partner. The referral code is created on first
 * approval and kept forever after. Emails the partner their link unless
 * `notify` is false.
 */
export async function approvePartner(
  partner,
  { commissionPercent, adminId, notify = true } = {}
) {
  if (!partner.referralCode) {
    partner.referralCode = await assignUniqueReferralCode(partner);
  }
  if (commissionPercent !== undefined) {
    partner.commissionPercent = commissionPercent;
  } else if (partner.commissionPercent == null) {
    partner.commissionPercent = await getDefaultCommissionPercent();
  }

  partner.status = "APPROVED";
  partner.approvedAt = new Date();
  partner.approvedBy = adminId || null;
  partner.rejectedAt = null;

  try {
    await partner.save();
  } catch (error) {
    // Two approvals racing for the same random code: retry once with a new one.
    if (error?.code === 11000 && error?.keyPattern?.referralCode) {
      partner.referralCode = await assignUniqueReferralCode(partner);
      await partner.save();
    } else {
      throw error;
    }
  }

  if (!notify) return { partner, emailSent: false };

  const emailResult = await sendPartnerLinkEmail(partner);
  return { partner, emailSent: emailResult.sent };
}

export async function sendPartnerLinkEmail(partner) {
  const email = partnerApprovedEmail({
    partner,
    link: referralLink(partner.referralCode),
  });
  return sendMail({ to: partner.email, subject: email.subject, html: email.html });
}

/** An approved partner for a referral code, or null. Never throws for bad input. */
export async function findActivePartnerByCode(code) {
  const referralCode = normalizeReferralCode(code);
  if (!referralCode) return null;
  return Partner.findOne({ referralCode, status: "APPROVED" });
}

/**
 * The partner snapshot stored on a booking. The percentage and amount are
 * frozen at booking time so later commission changes never rewrite history.
 */
export async function resolveBookingPartner(partnerCode, totalFare) {
  try {
    const partner = await findActivePartnerByCode(partnerCode);
    if (!partner) return null;

    const commissionPercent = Number(partner.commissionPercent ?? 0);
    return {
      partnerId: partner._id,
      referralCode: partner.referralCode,
      companyName: partner.companyName,
      commissionPercent,
      commissionAmount: partnerCommissionAmount(totalFare, commissionPercent),
    };
  } catch (error) {
    // Attribution must never block a paid booking.
    console.error("Partner attribution failed:", error);
    return null;
  }
}

const EMPTY_STATS = Object.freeze({
  totalBookings: 0,
  completedBookings: 0,
  completedRevenue: 0,
  commissionEarned: 0,
  commissionPending: 0,
});

/** Booking totals per partner id: earned = completed rides, pending = not yet completed. */
export async function partnerBookingStats(partnerIds) {
  const ids = partnerIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  if (ids.length === 0) return new Map();

  const rows = await Booking.aggregate([
    { $match: { "partner.partnerId": { $in: ids } } },
    {
      $group: {
        _id: { partnerId: "$partner.partnerId", status: "$status" },
        count: { $sum: 1 },
        revenue: { $sum: "$pricing.totalFare" },
        commission: { $sum: "$partner.commissionAmount" },
      },
    },
  ]);

  const stats = new Map();
  for (const row of rows) {
    const key = String(row._id.partnerId);
    const entry = stats.get(key) || { ...EMPTY_STATS };
    entry.totalBookings += row.count;

    if (row._id.status === "COMPLETED") {
      entry.completedBookings += row.count;
      entry.completedRevenue = roundMoney(entry.completedRevenue + row.revenue);
      entry.commissionEarned = roundMoney(entry.commissionEarned + row.commission);
    } else if (row._id.status !== "CANCELLED") {
      entry.commissionPending = roundMoney(entry.commissionPending + row.commission);
    }
    stats.set(key, entry);
  }
  return stats;
}

export function statsFor(stats, partnerId) {
  return stats.get(String(partnerId)) || { ...EMPTY_STATS };
}
