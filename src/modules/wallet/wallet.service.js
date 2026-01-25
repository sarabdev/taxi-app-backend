import { WalletTransaction } from "./wallet.model.js";

/**
 * Calculate wallet balance
 */
export async function getWalletBalance(driverId) {
  const txns = await WalletTransaction.find({ driverId }).lean();

  return txns.reduce((balance, t) => {
    return t.type === "CREDIT"
      ? balance + t.amount
      : balance - t.amount;
  }, 0);
}

/**
 * Generic credit (can still be used manually if needed)
 */
export async function creditWallet({
  driverId,
  amount,
  referenceType,
  referenceId,
  note,
}) {
  return WalletTransaction.create({
    driverId,
    type: "CREDIT",
    amount,
    referenceType,
    referenceId,
    note,
  });
}

/**
 * ✅ SAFE booking credit (idempotent)
 * This MUST be used for booking completion
 */
export async function creditBookingOnce({
  driverId,
  bookingId,
  amount,
}) {
  const existing = await WalletTransaction.findOne({
    driverId,
    type: "CREDIT",
    referenceType: "BOOKING",
    referenceId: bookingId,
  });

  // If already credited, do nothing
  if (existing) {
    return existing;
  }

  return WalletTransaction.create({
    driverId,
    type: "CREDIT",
    amount,
    referenceType: "BOOKING",
    referenceId: bookingId,
    note: "80% booking earnings",
  });
}
