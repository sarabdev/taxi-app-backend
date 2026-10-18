import {
  bookingReference,
  emailLayout,
  escapeHtml,
  fullBookingDetails,
} from "./email.helpers.js";

export function customerBookingCompletedEmail({ booking }) {
  const title = "Your journey is complete";

  return {
    subject: `Journey completed - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `Journey ${bookingReference(booking)} has been completed.`,
      content: `
      <p style="margin:0 0 14px;">Hello ${escapeHtml(booking.customerName)},</p>
      <p style="margin:0 0 14px;">Your airport taxi booking has been marked as completed.</p>
      <p style="margin:0 0 14px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      ${fullBookingDetails(booking)}
      <p style="margin:0;">Thank you for travelling with Zalt.</p>
      `,
    }),
  };
}
