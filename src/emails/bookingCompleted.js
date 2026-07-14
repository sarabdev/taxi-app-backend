import {
  bookingReference,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function bookingCompletedEmail({ booking, driverShare }) {
  return {
    subject: `Booking completed - ${bookingReference(booking)}`,
    html: `
      <h2>Booking completed</h2>
      <p>The booking has been completed successfully.</p>
      <p><b>Booking reference:</b> ${bookingReference(booking)}</p>
      ${journeySummary(booking)}
      <p><b>Total fare:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      <p><b>Your earnings (80%):</b> ${formatMoney(driverShare)}</p>
    `,
  };
}
