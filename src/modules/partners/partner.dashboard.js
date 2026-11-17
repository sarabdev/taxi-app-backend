import { Partner } from "./partner.model.js";
import { Booking } from "../bookings/booking.model.js";
import { partnerBookingStats, statsFor } from "./partner.service.js";
import { partnerDashboardLink, verifyAccessLink } from "../../utils/accessLinks.js";
import { partnerDashboardEmail } from "../../emails/partnerBooking.js";
import { queueEmail } from "../notifications/notification.service.js";

export async function requestDashboardLink(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: "Enter a valid email address" });
  // Atomic cooldown; identical responses prevent account enumeration.
  const requestedAt = new Date();
  const partner = await Partner.findOneAndUpdate({ email, status: "APPROVED", $or: [
    { dashboardEmailRequestedAt: null }, { dashboardEmailRequestedAt: { $lt: new Date(Date.now() - 5 * 60000) } },
  ] }, { $set: { dashboardEmailRequestedAt: requestedAt } }, { new: true });
  if (partner) {
    try {
      await queueEmail(`partner:${partner._id}:access:${requestedAt.getTime()}`, partner.email,
        partnerDashboardEmail({ partner, dashboardLink: partnerDashboardLink(partner) }));
    } catch (error) {
      await Partner.updateOne({ _id: partner._id, dashboardEmailRequestedAt: requestedAt }, { $set: { dashboardEmailRequestedAt: null } });
      throw error;
    }
  }
  res.json({ message: "If this email belongs to an approved partner, a dashboard link will arrive shortly." });
}

export async function partnerDashboard(req, res) {
  res.set("Cache-Control", "no-store");
  let claims;
  try { claims = verifyAccessLink(String(req.headers.authorization || "").replace(/^Bearer /, ""), "partner-dashboard"); }
  catch { return res.status(401).json({ message: "This dashboard link is invalid or expired. Request a new link." }); }
  const partner = await Partner.findById(claims.sub);
  if (!partner || partner.status !== "APPROVED" || partner.email !== claims.email) return res.status(401).json({ message: "Dashboard access is unavailable. Contact support." });
  const [stats, bookings] = await Promise.all([
    partnerBookingStats([partner._id]),
    Booking.find({ "partner.partnerId": partner._id }).select("status pickupDate pickupTime createdAt").sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  const totals = statsFor(stats, partner._id);
  res.json({ companyName: partner.companyName, totalEarnings: totals.commissionEarned,
    totalRides: totals.totalBookings, completedRides: totals.completedBookings,
    rides: bookings.map((b) => ({ reference: String(b._id).slice(-8).toUpperCase(), status: b.status, pickupDate: b.pickupDate, pickupTime: b.pickupTime })) });
}
