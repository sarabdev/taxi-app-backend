import { Partner } from "./partner.model.js";
import { partnerDashboardLink } from "../../utils/accessLinks.js";
import { partnerBookingEmail } from "../../emails/partnerBooking.js";
import { queueEmail } from "../notifications/notification.service.js";

export async function notifyPartnerBooking(booking, completed = false) {
  if (!booking.partner?.partnerId) return;
  const partner = await Partner.findById(booking.partner.partnerId);
  if (!partner || partner.status !== "APPROVED") return;
  await queueEmail(`booking:${booking._id}:partner:${completed ? "completed" : "confirmed"}`, partner.email,
    partnerBookingEmail({ partner, booking, completed, dashboardLink: partnerDashboardLink(partner) }));
}
