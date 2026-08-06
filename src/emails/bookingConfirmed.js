import {
  bookingReference,
  emailLayout,
  escapeHtml,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function bookingConfirmedEmail({ booking }) {
  const title = "Your airport taxi is booked";

  return {
    subject: `Booking confirmed - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `Booking ${bookingReference(booking)} is confirmed.`,
      content: `
      <p style="margin:0 0 14px;">Hello ${escapeHtml(booking.customerName)},</p>
      <p style="margin:0 0 14px;">Thank you for booking with My Airport Taxis. Your payment and booking have been confirmed.</p>
      <p style="margin:0 0 14px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      ${journeySummary(booking)}
      ${booking.flight?.meetAndGreet ? `<p style="margin:0 0 14px;"><b style="color:#0f172a;">Meet &amp; Greet:</b> Selected (${formatMoney(booking.pricing?.meetAndGreetFee)})</p>` : ""}
      <p style="margin:0 0 14px;font-size:18px;"><b style="color:#0f172a;">Total paid:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      <p style="margin:0;">We will contact you if there is an important update to your journey.</p>
      `,
    }),
  };
}
