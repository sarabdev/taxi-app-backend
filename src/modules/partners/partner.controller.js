import mongoose from "mongoose";
import { Partner } from "./partner.model.js";
import { Booking } from "../bookings/booking.model.js";
import {
  adminCreatePartnerSchema,
  adminUpdatePartnerSchema,
  approvePartnerSchema,
  parseOrThrow,
  partnerApplicationSchema,
} from "./partner.validators.js";
import {
  approvePartner,
  findActivePartnerByCode,
  getDefaultCommissionPercent,
  partnerBookingStats,
  referralLink,
  sendPartnerLinkEmail,
  statsFor,
} from "./partner.service.js";
import { sendMail } from "../../utils/mailer.js";
import {
  adminPartnerApplicationEmail,
  partnerApplicationReceivedEmail,
} from "../../emails/partnerApplication.js";

const PARTNER_ADMIN_EMAIL = "myairporttaxi86@gmail.com";

function sendError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({ message: "This partner already exists" });
  }
  const status = error?.status || 400;
  if (status >= 500) console.error(error);
  return res.status(status).json({ message: error?.message || "Request failed" });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function findPartnerOrThrow(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Partner not found");
  const partner = await Partner.findById(id);
  if (!partner) throw httpError(404, "Partner not found");
  return partner;
}

/** Adds the shareable link and booking stats the admin UI needs. */
function toAdminPartner(partner, stats) {
  const json = partner.toObject ? partner.toObject() : partner;
  return {
    ...json,
    referralLink: json.referralCode ? referralLink(json.referralCode) : null,
    stats: statsFor(stats, json._id),
  };
}

async function adminPartnerResponse(partner) {
  const stats = await partnerBookingStats([partner._id]);
  return toAdminPartner(partner, stats);
}

async function assertNoOpenPartnerWithEmail(email, excludeId) {
  const existing = await Partner.findOne({
    email,
    status: { $in: ["PENDING", "APPROVED", "SUSPENDED"] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();

  if (existing) {
    throw httpError(
      409,
      existing.status === "PENDING"
        ? "An enquiry with this email is already being reviewed."
        : "A partner with this email already exists."
    );
  }
}

/* ───────────────────── Public ───────────────────── */

export async function applyAsPartner(req, res) {
  try {
    const { website: _honeypot, ...details } = parseOrThrow(
      partnerApplicationSchema,
      req.body
    );
    await assertNoOpenPartnerWithEmail(details.email);

    const partner = await Partner.create({ ...details, source: "WEBSITE" });

    const applicantEmail = partnerApplicationReceivedEmail({ partner });
    const adminEmail = adminPartnerApplicationEmail({ partner });
    await Promise.all([
      sendMail({
        to: partner.email,
        subject: applicantEmail.subject,
        html: applicantEmail.html,
      }),
      sendMail({
        to: PARTNER_ADMIN_EMAIL,
        replyTo: partner.email,
        subject: adminEmail.subject,
        html: adminEmail.html,
      }),
    ]);

    res.status(201).json({
      message: "Thank you. We will review your enquiry and be in touch shortly.",
    });
  } catch (error) {
    sendError(res, error);
  }
}

/** Lets the website confirm a referral code before remembering it. */
export async function getReferral(req, res) {
  const partner = await findActivePartnerByCode(req.params.code);
  if (!partner) return res.status(404).json({ message: "Referral code not found" });
  res.json({ referralCode: partner.referralCode, companyName: partner.companyName });
}

/* ───────────────────── Admin ───────────────────── */

export async function listPartners(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();

    const partners = await Partner.find(filter).sort({ createdAt: -1 });
    const stats = await partnerBookingStats(partners.map((partner) => partner._id));
    res.json({
      partners: partners.map((partner) => toAdminPartner(partner, stats)),
      defaultCommissionPercent: await getDefaultCommissionPercent(),
    });
  } catch (error) {
    sendError(res, { status: 500, message: error.message });
  }
}

export async function createPartner(req, res) {
  try {
    const { sendEmail, commissionPercent, ...details } = parseOrThrow(
      adminCreatePartnerSchema,
      req.body
    );
    await assertNoOpenPartnerWithEmail(details.email);

    // Admin-created partners are approved straight away.
    const partner = new Partner({ ...details, source: "ADMIN" });
    const { emailSent } = await approvePartner(partner, {
      commissionPercent,
      adminId: req.user.id,
      notify: sendEmail,
    });

    res.status(201).json({ partner: await adminPartnerResponse(partner), emailSent });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updatePartner(req, res) {
  try {
    const partner = await findPartnerOrThrow(req.params.id);
    const changes = parseOrThrow(adminUpdatePartnerSchema, req.body);
    if (changes.email && changes.email !== partner.email) {
      await assertNoOpenPartnerWithEmail(changes.email, partner._id);
    }

    partner.set(changes);
    await partner.save();
    res.json({ partner: await adminPartnerResponse(partner) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function approve(req, res) {
  try {
    const partner = await findPartnerOrThrow(req.params.id);
    if (partner.status === "APPROVED") {
      throw httpError(409, "Partner is already approved");
    }
    const { commissionPercent } = parseOrThrow(approvePartnerSchema, req.body);
    // A rejected or suspended partner may have re-applied under the same email.
    await assertNoOpenPartnerWithEmail(partner.email, partner._id);
    const { emailSent } = await approvePartner(partner, {
      commissionPercent,
      adminId: req.user.id,
    });
    res.json({ partner: await adminPartnerResponse(partner), emailSent });
  } catch (error) {
    sendError(res, error);
  }
}

export async function reject(req, res) {
  try {
    const partner = await findPartnerOrThrow(req.params.id);
    if (partner.status !== "PENDING") {
      throw httpError(409, "Only pending enquiries can be rejected");
    }
    partner.status = "REJECTED";
    partner.rejectedAt = new Date();
    await partner.save();
    res.json({ partner: await adminPartnerResponse(partner) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function suspend(req, res) {
  try {
    const partner = await findPartnerOrThrow(req.params.id);
    if (partner.status !== "APPROVED") {
      throw httpError(409, "Only approved partners can be suspended");
    }
    // Suspended links stop earning commission; the code is kept for reactivation.
    partner.status = "SUSPENDED";
    await partner.save();
    res.json({ partner: await adminPartnerResponse(partner) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function resendLink(req, res) {
  try {
    const partner = await findPartnerOrThrow(req.params.id);
    if (partner.status !== "APPROVED") {
      throw httpError(409, "Only approved partners have an active link");
    }
    const { sent } = await sendPartnerLinkEmail(partner);
    if (!sent) throw httpError(502, "The email could not be sent. Please try again.");
    res.json({ message: `Link sent to ${partner.email}` });
  } catch (error) {
    sendError(res, error);
  }
}

export async function listPartnerBookings(req, res) {
  try {
    const partner = await findPartnerOrThrow(req.params.id);
    const bookings = await Booking.find({ "partner.partnerId": partner._id })
      .select(
        "customerName pickupLocation dropoffLocation pickupDate pickupTime status pricing.totalFare partner createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json(bookings);
  } catch (error) {
    sendError(res, error);
  }
}
