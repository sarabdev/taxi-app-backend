import { Payout } from "./payout.model.js";
import { Driver } from "../drivers/driver.model.js";
import { WalletTransaction } from "../wallet/wallet.model.js";
import { getWalletBalance } from "../wallet/wallet.service.js";

export async function adminListPayouts(req, res) {
  const { driverId } = req.query;

  const filter = driverId ? { driverId } : {};
  const payouts = await Payout.find(filter)
    .populate("driverId", "name phone")
    .sort({ createdAt: -1 });

  res.json(payouts);
}

export async function adminCreatePayout(req, res) {
  const { driverId, amount, method = "BANK", reference = "", note = "" } = req.body;

  if (!driverId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "driverId and positive amount required" });
  }

  // Safety: prevent paying more than available wallet balance
  const balance = await getWalletBalance(driverId);
  if (Number(amount) > balance) {
    return res.status(400).json({
      message: `Insufficient wallet balance. Available: ${balance.toFixed(2)}`,
    });
  }

  // Create payout record
  const payout = await Payout.create({
    driverId,
    amount: Number(amount),
    method,
    status: "PAID",
    reference,
    note,
  });

  // Create wallet DEBIT ledger entry linked to payout
  await WalletTransaction.create({
    driverId,
    type: "DEBIT",
    amount: Number(amount),
    referenceType: "PAYOUT",
    referenceId: payout._id,
    note: note || "Manual payout by admin",
  });

  res.json({ payout });
}

export async function driverMyPayouts(req, res) {
  const driver = await Driver.findOne({ userId: req.user.id });
  if (!driver) return res.json({ payouts: [] });

  const payouts = await Payout.find({ driverId: driver._id }).sort({ createdAt: -1 });
  res.json({ payouts });
}
