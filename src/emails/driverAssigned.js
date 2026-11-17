import {
  bookingReference,
  emailLayout,
  fullBookingDetails,
  formatMoney,
  escapeHtml,
} from "./email.helpers.js";

export function driverAssignedEmail({ booking, completionLink }) {
  const title = "New booking assigned";

  return {
    subject: `New booking assigned - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `You have been assigned booking ${bookingReference(booking)}.`,
      content: `
      <p style="margin:0 0 14px;">You have been assigned a new booking.</p>
      <p style="margin:0 0 14px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      ${fullBookingDetails(booking, { showFare: false })}
      ${booking.driverAmount != null ? `<p><b>Your agreed amount:</b> ${formatMoney(booking.driverAmount)}</p>` : ""}
      ${completionLink ? `<p><a href="${escapeHtml(completionLink)}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#fff;border-radius:12px;text-decoration:none;">Open ride &amp; enter job-end code</a></p>
      <p>At drop-off, ask the customer for their 4-digit job-end code and enter it using this private link. Do not forward this link.</p>` : ""}
      `,
    }),
  };
}
