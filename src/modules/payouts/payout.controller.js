import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Payout } from "./payout.model.js";
import { Driver } from "../drivers/driver.model.js";
import {
  getDriverAccounting,
  roundMoney,
} from "../accounting/accounting.service.js";

const PAYOUT_METHODS = new Set(["BANK", "CASH", "OTHER"]);
const PAYOUT_LOCK_MS = 60_000;

export async function adminListPayouts(req, res) {
  const { driverId } = req.query;
  const filter = driverId ? { driverId } : {};
  const payouts = await Payout.find(filter)
    .populate("driverId", "name phone")
    .sort({ createdAt: -1 });

  res.json(payouts);
}

export async function adminCreatePayout(req, res) {
  const {
    driverId,
    amount,
    method = "BANK",
    reference = "",
    note = "",
    requestId,
  } = req.body;
  const payoutAmount = roundMoney(amount);
  const normalizedRequestId =
    typeof requestId === "string" ? requestId.trim() : "";

  const requestMatches = (payout) =>
    payout.driverId.toString() === driverId &&
    roundMoney(payout.amount) === payoutAmount &&
    payout.method === method &&
    (payout.reference || "") === String(reference || "") &&
    (payout.note || "") === String(note || "");

  if (
    !mongoose.isValidObjectId(driverId) ||
    payoutAmount <= 0
  ) {
    return res
      .status(400)
      .json({ message: "A valid driver and positive amount are required" });
  }
  if (!normalizedRequestId || normalizedRequestId.length > 100) {
    return res.status(400).json({ message: "Payout request ID is required" });
  }
  if (!PAYOUT_METHODS.has(method)) {
    return res.status(400).json({ message: "Invalid payout method" });
  }

  const previous = await Payout.findOne({ requestId: normalizedRequestId });
  if (previous) {
    if (!requestMatches(previous)) {
      return res.status(409).json({
        message: "This payout request ID was already used for another payout",
      });
    }
    return res.json({ payout: previous, idempotent: true });
  }

  const lockToken = randomUUID();
  const now = new Date();
  const lockedDriver = await Driver.findOneAndUpdate(
    {
      _id: driverId,
      $or: [
        { payoutLockToken: null },
        { payoutLockToken: { $exists: false } },
        { payoutLockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        payoutLockToken: lockToken,
        payoutLockExpiresAt: new Date(now.getTime() + PAYOUT_LOCK_MS),
      },
    },
    { new: true }
  ).select("+payoutLockToken");

  if (!lockedDriver) {
    const exists = await Driver.exists({ _id: driverId });
    return res.status(exists ? 409 : 404).json({
      message: exists
        ? "Another payout for this driver is being processed. Please retry."
        : "Driver not found",
    });
  }

  try {
    const existing = await Payout.findOne({ requestId: normalizedRequestId });
    if (existing) {
      if (!requestMatches(existing)) {
        return res.status(409).json({
          message: "This payout request ID was already used for another payout",
        });
      }
      return res.json({ payout: existing, idempotent: true });
    }

    const accounting = await getDriverAccounting(driverId);
    if (payoutAmount > accounting.balance) {
      return res.status(400).json({
        message: `Insufficient driver balance. Available: ${accounting.balance.toFixed(2)}`,
      });
    }

    const payout = await Payout.create({
      driverId,
      amount: payoutAmount,
      method,
      status: "PAID",
      reference,
      note,
      requestId: normalizedRequestId,
    });

    return res.json({ payout });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Payout.findOne({
        requestId: normalizedRequestId,
      });
      if (existing && requestMatches(existing)) {
        return res.json({ payout: existing, idempotent: true });
      }
    }

    console.error("Create payout failed:", error);
    return res.status(500).json({ message: "Failed to create payout safely" });
  } finally {
    try {
      await Driver.updateOne(
        { _id: driverId, payoutLockToken: lockToken },
        { $set: { payoutLockToken: null, payoutLockExpiresAt: null } }
      );
    } catch (error) {
      console.error("Payout lock release failed:", error);
    }
  }
}

export async function driverMyPayouts(req, res) {
  const driver = await Driver.findOne({ userId: req.user.id });
  if (!driver) return res.json({ payouts: [] });

  const payouts = await Payout.find({
    driverId: driver._id,
    status: "PAID",
  }).sort({ createdAt: -1 });
  res.json({ payouts });
}
