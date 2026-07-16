import {
  bookingReference,
  escapeHtml,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function adminBookingConfirmedEmail({ booking }) {
  return {
    subject: `New booking confirmed - ${bookingReference(booking)}`,
    html: `
      <h2>New booking confirmed</h2>
      <p><b>Booking reference:</b> ${bookingReference(booking)}</p>
      <p><b>Customer:</b> ${escapeHtml(booking.customerName)}</p>
      <p><b>Customer email:</b> ${escapeHtml(booking.customerEmail)}</p>
      ${journeySummary(booking)}
      <p><b>Total paid:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
    `,
  };
}
