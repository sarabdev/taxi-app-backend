import {
  bookingReference,
  emailLayout,
  escapeHtml,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function adminBookingConfirmedEmail({ booking }) {
  const title = "New booking confirmed";

  return {
    subject: `New booking confirmed - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `New booking ${bookingReference(booking)} has been confirmed.`,
      content: `
      <p style="margin:0 0 10px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      <p style="margin:0 0 10px;"><b style="color:#0f172a;">Customer:</b> ${escapeHtml(booking.customerName)}</p>
      <p style="margin:0 0 10px;"><b style="color:#0f172a;">Customer email:</b> ${escapeHtml(booking.customerEmail)}</p>
      ${journeySummary(booking)}
      <p style="margin:0;font-size:18px;"><b style="color:#0f172a;">Total paid:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      `,
    }),
  };
}
