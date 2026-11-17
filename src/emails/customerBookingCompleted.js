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
      <div style="margin-top:22px;padding:18px;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;">
        <h2 style="margin:0 0 10px;font-size:20px;color:#0f172a;">Your next journeys come with a reward</h2>
        <p>Book and complete two more rides with Zalt to unlock a discount in pounds on a future booking.</p>
        <a href="https://zalt.uk" style="color:#0f172a;font-weight:700;">Book your next ride</a>
        <p style="margin-bottom:0;font-size:13px;">Use the same booking email and contact support@zalt.uk to arrange your reward after both rides are completed.</p>
      </div>
      `,
    }),
  };
}
