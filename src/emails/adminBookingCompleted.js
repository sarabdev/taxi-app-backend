import {
  bookingReference,
  escapeHtml,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function adminBookingCompletedEmail({
  booking,
  driverShare,
  platformShare,
}) {
  return {
    subject: `Booking completed - ${bookingReference(booking)}`,
    html: `
      <h2>Booking completed</h2>
      <p><b>Booking reference:</b> ${bookingReference(booking)}</p>
      <p><b>Customer:</b> ${escapeHtml(booking.customerName)}</p>
      <p><b>Customer email:</b> ${escapeHtml(booking.customerEmail)}</p>
      <p><b>Driver:</b> ${escapeHtml(booking.assignedDriverId?.name || "Unknown")}</p>
      ${journeySummary(booking)}
      <p><b>Total fare:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      <p><b>Driver earnings (80%):</b> ${formatMoney(driverShare)}</p>
      <p><b>Platform share (20%):</b> ${formatMoney(platformShare)}</p>
    `,
  };
}
