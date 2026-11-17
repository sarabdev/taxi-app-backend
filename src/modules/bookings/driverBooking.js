// Explicit allowlist: customer fares, partner commission, payment identifiers,
// vehicle pricing and the customer's completion secret never leave this boundary.
export function driverBooking(booking) {
  const b = booking.toObject ? booking.toObject() : booking;
  const fields = ["_id", "customerName", "customerPhone", "pickupLocation", "dropoffLocation", "stops",
    "pickupDate", "pickupTime", "isReturnTrip", "returnTrip", "passengers", "luggage", "flight",
    "status", "completionNote", "completedAt", "createdAt", "driverAmount"];
  return {
    ...Object.fromEntries(fields.filter((key) => b[key] !== undefined).map((key) => [key, b[key]])),
    carId: b.carId ? { name: b.carId.name || "Airport taxi" } : null,
    requiresCompletionCode: Boolean(b.completionCode),
  };
}

export function parseDriverAmount(value) {
  if (value === undefined || value === null || value === "") return null;
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") throw new Error("Enter a valid driver amount");
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
    throw new Error("Driver amount must be a non-negative GBP amount with up to two decimal places");
  }
  return amount;
}
