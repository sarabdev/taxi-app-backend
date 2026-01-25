export function bookingCompletedEmail({ booking, driverShare }) {
  return {
    subject: "Booking Completed",
    html: `
      <h2>Booking Completed</h2>
      <p>The booking has been completed successfully.</p>
      <p><b>Total Fare:</b> $${booking.pricing.totalFare}</p>
      <p><b>Your Earnings (80%):</b> $${driverShare}</p>
    `,
  };
}
