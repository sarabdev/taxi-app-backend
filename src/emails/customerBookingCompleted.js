import {
  bookingReference,
  escapeHtml,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function customerBookingCompletedEmail({ booking }) {
  return {
    subject: `Journey completed - ${bookingReference(booking)}`,
    html: `
      <h2>Your journey is complete</h2>
      <p>Hello ${escapeHtml(booking.customerName)},</p>
      <p>Your airport taxi booking has been marked as completed.</p>
      <p><b>Booking reference:</b> ${bookingReference(booking)}</p>
      ${journeySummary(booking)}
      <p><b>Total paid:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      <p>Thank you for travelling with My Airport Taxis.</p>
      <p>My Airport Taxis<br />support@myairporttaxis.uk</p>
    `,
  };
}
