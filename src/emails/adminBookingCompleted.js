import {
  bookingReference,
  emailLayout,
  escapeHtml,
  fullBookingDetails,
  formatMoney,
} from "./email.helpers.js";

export function adminBookingCompletedEmail({
  booking,
  driverShare,
  platformShare,
}) {
  const title = "Booking completed";

  return {
    subject: `Booking completed - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `Booking ${bookingReference(booking)} has been completed.`,
      content: `
      <p style="margin:0 0 10px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      <p style="margin:0 0 10px;"><b style="color:#0f172a;">Driver:</b> ${escapeHtml(booking.assignedDriverId?.name || "Unknown")}</p>
      ${fullBookingDetails(booking)}
      <div style="margin-top:18px;padding:18px;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;">
        <p style="margin:0 0 8px;"><b style="color:#0f172a;">Total fare:</b> ${formatMoney(booking.pricing?.totalFare)}</p>
        <p style="margin:0 0 8px;"><b style="color:#0f172a;">Driver earnings (80%):</b> ${formatMoney(driverShare)}</p>
        <p style="margin:0;"><b style="color:#0f172a;">Platform share (20%):</b> ${formatMoney(platformShare)}</p>
      </div>
      `,
    }),
  };
}
