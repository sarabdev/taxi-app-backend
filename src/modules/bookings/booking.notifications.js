import { Booking } from "./booking.model.js";
import { queueEmail } from "../notifications/notification.service.js";
import { notifyPartnerBooking } from "../partners/partner.notifications.js";
import { bookingConfirmedEmail } from "../../emails/bookingConfirmed.js";
import { adminBookingConfirmedEmail } from "../../emails/adminBookingConfirmed.js";
import { driverAssignedEmail } from "../../emails/driverAssigned.js";
import { bookingCompletedEmail } from "../../emails/bookingCompleted.js";
import { customerBookingCompletedEmail } from "../../emails/customerBookingCompleted.js";
import { adminBookingCompletedEmail } from "../../emails/adminBookingCompleted.js";
import { driverEarningsForBooking, roundMoney } from "../accounting/accounting.service.js";
import { driverCompletionLink } from "../../utils/accessLinks.js";

const ADMIN_EMAILS = ["myairporttaxi86@gmail.com", "booking@zalt.uk"];
export const bookingEmailPopulation = [
  { path: "carId" },
  { path: "assignedDriverId", populate: { path: "userId", select: "email role isActive" } },
];

export async function queueBookingNotifications(booking, event, nonce = "") {
  try {
    const jobs = [];
    if (event === "confirmed") {
      jobs.push(queueEmail(`booking:${booking._id}:confirmed:customer`, booking.customerEmail, bookingConfirmedEmail({ booking })),
        queueEmail(`booking:${booking._id}:confirmed:admin`, ADMIN_EMAILS, adminBookingConfirmedEmail({ booking })),
        notifyPartnerBooking(booking));
    } else if (event === "completed") {
      const driverShare = driverEarningsForBooking(booking);
      const platformShare = roundMoney(Number(booking.pricing?.totalFare || 0) - driverShare);
      const driverEmail = booking.assignedDriverId?.userId?.email;
      if (driverEmail) jobs.push(queueEmail(`booking:${booking._id}:completed:driver`, driverEmail, bookingCompletedEmail({ booking })));
      jobs.push(queueEmail(`booking:${booking._id}:completed:customer`, booking.customerEmail, customerBookingCompletedEmail({ booking })),
        queueEmail(`booking:${booking._id}:completed:admin`, ADMIN_EMAILS, adminBookingCompletedEmail({ booking, driverShare, platformShare })),
        notifyPartnerBooking(booking, true));
    } else if (event === "assignment" && nonce) {
      const driverEmail = booking.assignedDriverId?.userId?.email;
      if (driverEmail) jobs.push(queueEmail(`booking:${booking._id}:assigned:${nonce}`, driverEmail,
        driverAssignedEmail({ booking, completionLink: driverCompletionLink(booking, nonce) })));
    } else { throw new Error("Unknown booking notification event"); }
    const results = await Promise.allSettled(jobs);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    await Booking.updateOne({ _id: booking._id, ...(event === "assignment" ? { "notificationPending.assignment": nonce } : {}) }, {
      $set: { [`notificationPending.${event}`]: event === "assignment" ? "" : false },
    });
    return true;
  } catch (error) {
    console.error(`Booking ${event} notifications remain pending:`, error.message);
    return false;
  }
}

export async function recoverBookingNotifications() {
  const bookings = await Booking.find({ $or: [
    { "notificationPending.confirmed": true }, { "notificationPending.completed": true },
    { "notificationPending.assignment": { $gt: "" } },
  ] }).select("+completionCode +driverAccessNonce +notificationPending").populate(bookingEmailPopulation).limit(50);
  for (const booking of bookings) {
    if (booking.notificationPending?.confirmed) await queueBookingNotifications(booking, "confirmed");
    const nonce = booking.notificationPending?.assignment;
    if (nonce) {
      if (nonce === booking.driverAccessNonce && ["ASSIGNED", "COMPLETED"].includes(booking.status)) {
        await queueBookingNotifications(booking, "assignment", nonce);
      } else {
        await Booking.updateOne({ _id: booking._id, "notificationPending.assignment": nonce }, { $set: { "notificationPending.assignment": "" } });
      }
    }
    if (booking.notificationPending?.completed && booking.status === "COMPLETED") await queueBookingNotifications(booking, "completed");
  }
}
