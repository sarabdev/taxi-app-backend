export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

export function bookingReference(booking) {
  return String(booking._id || "").slice(-8).toUpperCase();
}

export function journeySummary(booking) {
  const outward = `
    <p><b>Pickup:</b> ${escapeHtml(booking.pickupLocation)}</p>
    <p><b>Drop-off:</b> ${escapeHtml(booking.dropoffLocation)}</p>
    <p><b>Booked for:</b> ${escapeHtml(booking.pickupDate)} ${escapeHtml(booking.pickupTime)}</p>
  `;

  if (!booking.isReturnTrip || !booking.returnTrip) return outward;

  return `${outward}
    <hr />
    <p><b>Return pickup:</b> ${escapeHtml(booking.returnTrip.pickupLocation)}</p>
    <p><b>Return drop-off:</b> ${escapeHtml(booking.returnTrip.dropoffLocation)}</p>
    <p><b>Return booked for:</b> ${escapeHtml(booking.returnTrip.pickupDate)} ${escapeHtml(booking.returnTrip.pickupTime)}</p>
  `;
}
