import {
  bookingReference,
  emailLayout,
  escapeHtml,
  fullBookingDetails,
} from "./email.helpers.js";

export function bookingConfirmedEmail({ booking }) {
  const title = "Your airport transfer is booked.";

  return {
    subject: `Booking confirmed - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `Booking ${bookingReference(booking)} is confirmed.`,
      content: `
      <p style="margin:0 0 14px;">Hello ${escapeHtml(booking.customerName)},</p>
      <p style="margin:0 0 14px;">Thank you for booking with us. Your payment and booking have been confirmed.</p>
      <p style="margin:0 0 14px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      ${fullBookingDetails(booking)}
      <p style="margin:0;">We will contact you if there is an important update to your journey.</p>
      `,
    }),
  };
}
