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
      ${
        booking.completionCode
          ? `<div style="margin:18px 0;padding:18px;background:#fef9c3;border:1px solid #facc15;border-radius:14px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#854d0e;font-weight:700;">Your job-end code</p>
        <p style="margin:0 0 8px;font-size:32px;line-height:38px;letter-spacing:8px;font-weight:800;color:#0f172a;">${escapeHtml(booking.completionCode)}</p>
        <p style="margin:0;font-size:13px;color:#713f12;">Give this code to your driver only when you have arrived. Please don't share it before the ride ends.</p>
      </div>`
          : ""
      }
      ${fullBookingDetails(booking)}
      <p style="margin:0;">We will contact you if there is an important update to your journey.</p>
      `,
    }),
  };
}
