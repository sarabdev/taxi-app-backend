import {
  bookingReference,
  emailLayout,
  fullBookingDetails,
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
      ${fullBookingDetails(booking)}
      `,
    }),
  };
}
