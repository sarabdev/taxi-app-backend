import {
  bookingReference,
  emailLayout,
  fullBookingDetails,
  formatMoney,
} from "./email.helpers.js";

export function bookingCompletedEmail({ booking }) {
  const title = "Booking completed";

  return {
    subject: `Booking completed - ${bookingReference(booking)}`,
    html: emailLayout({
      title,
      preheader: `Booking ${bookingReference(booking)} has been completed.`,
      content: `
      <p style="margin:0 0 14px;">The booking has been completed successfully.</p>
      <p style="margin:0 0 14px;"><b style="color:#0f172a;">Booking reference:</b> ${bookingReference(booking)}</p>
      ${fullBookingDetails(booking, { showFare: false })}
      ${booking.driverAmount != null ? `<p><b>Your agreed amount:</b> ${formatMoney(booking.driverAmount)}</p>` : ""}
      `,
    }),
  };
}
