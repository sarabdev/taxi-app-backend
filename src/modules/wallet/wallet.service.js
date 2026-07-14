import { getDriverAccounting } from "../accounting/accounting.service.js";

/**
 * Available driver balance is derived from completed bookings minus PAID
 * payout records. Legacy wallet rows are deliberately not authoritative.
 */
export async function getWalletBalance(driverId) {
  const accounting = await getDriverAccounting(driverId);
  return accounting.balance;
}
