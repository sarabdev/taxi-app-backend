import {
  bookingReference,
  emailLayout,
  formatMoney,
  journeySummary,
} from "./email.helpers.js";

export function driverAssignedEmail({ booking }) {
  const title = "New booking assigned";

  return {
    subject: `New booking assigned - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `You have been assigned booking ${bookingReference(booking)}.`,
      content: `
      <p style="margin:0 0 14px;">You have been assigned a new booking.</p>
      <p style="margin:0 0 14px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      ${journeySummary(booking)}
      ${booking.flight?.meetAndGreet ? `<p style="margin:0 0 14px;"><b style="color:#0f172a;">Meet &amp; Greet:</b> Meet the passenger inside the airport arrivals terminal.</p>` : ""}
      <p style="margin:0;font-size:18px;"><b style="color:#0f172a;">Total fare:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
      `,
    }),
  };
}
