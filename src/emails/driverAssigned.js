import {
  bookingReference,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function driverAssignedEmail({ booking }) {
  return {
    subject: `New booking assigned - ${bookingReference(booking)}`,
    html: `
      <h2>New booking assigned</h2>
      <p>You have been assigned a new booking.</p>
      <p><b>Booking reference:</b> ${bookingReference(booking)}</p>
      ${journeySummary(booking)}
      <p><b>Total fare:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
    `,
  };
}
