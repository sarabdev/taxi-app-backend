import {
  bookingReference,
  escapeHtml,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function bookingConfirmedEmail({ booking }) {
  return {
    subject: `Booking confirmed - ${bookingReference(booking)}`,
    html: `
      <h2>Your airport taxi is booked</h2>
      <p>Hello ${escapeHtml(booking.customerName)},</p>
      <p>Thank you for booking with My Airport Taxis. Your payment and booking have been confirmed.</p>
      <p><b>Booking reference:</b> ${bookingReference(booking)}</p>
      ${journeySummary(booking)}
      <p><b>Total paid:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      <p>We will contact you if there is an important update to your journey.</p>
      <p>My Airport Taxis<br />support@myairporttaxis.uk</p>
    `,
  };
}
