export function driverAssignedEmail({ booking }) {
  return {
    subject: "New Booking Assigned",
    html: `
      <h2>New Booking Assigned</h2>
      <p>You have been assigned a new booking.</p>
      <p><b>Pickup:</b> ${booking.pickupLocation}</p>
      <p><b>Dropoff:</b> ${booking.dropoffLocation}</p>
      <p><b>Total Fare:</b> $${booking.pricing.totalFare}</p>
    `,
  };
}
