import mongoose from "mongoose";
import { Booking } from "../bookings/booking.model.js";
import { Payout } from "../payouts/payout.model.js";

export const DRIVER_SHARE_RATE = 0.8;

export function roundMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

export function driverShareForFare(totalFare) {
  return roundMoney(Math.max(0, Number(totalFare) || 0) * DRIVER_SHARE_RATE);
}

export function platformShareForFare(totalFare) {
  return roundMoney(
    Math.max(0, Number(totalFare) || 0) - driverShareForFare(totalFare)
  );
}

export function driverEarningsForBooking(booking) {
  return booking.driverAmount != null ? roundMoney(booking.driverAmount) : driverShareForFare(booking.pricing?.totalFare);
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

export async function getDriverAccounting(driverId, { session, visibleOnly = false } = {}) {
  const objectId = new mongoose.Types.ObjectId(driverId);
  let earnings;
  let payouts;

  const earningsQuery = withSession(
      Booking.find({
        assignedDriverId: objectId,
        status: "COMPLETED",
      })
        .select("pricing.totalFare driverAmount")
        .lean(),
      session
    );
  const payoutsQuery = withSession(
      Payout.find({ driverId: objectId, status: "PAID" })
        .select("amount")
        .lean(),
      session
    );

  if (session) {
    // MongoDB transactions do not support parallel operations on one session.
    earnings = await earningsQuery;
    payouts = await payoutsQuery;
  } else {
    [earnings, payouts] = await Promise.all([earningsQuery, payoutsQuery]);
  }

  const earned = roundMoney(
    earnings.reduce(
      (sum, booking) => sum + (visibleOnly && booking.driverAmount == null ? 0 : driverEarningsForBooking(booking)),
      0
    )
  );
  const paid = roundMoney(
    payouts.reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0)
  );

  return {
    hasVisibleAmounts: earnings.some((booking) => booking.driverAmount != null),
    earned,
    paid,
    // A partial list of agreed earnings cannot establish the driver's balance.
    balance: visibleOnly && earnings.some((booking) => booking.driverAmount == null)
      ? null : roundMoney(Math.max(0, earned - paid)),
  };
}

export async function getPlatformAccounting() {
  const [bookings, payouts] = await Promise.all([
    Booking.find({ status: "COMPLETED" })
      .select("pricing.totalFare assignedDriverId driverAmount")
      .lean(),
    Payout.find({ status: "PAID" }).select("amount").lean(),
  ]);

  const grossRevenue = roundMoney(
    bookings.reduce(
      (sum, booking) => sum + (Number(booking.pricing?.totalFare) || 0),
      0
    )
  );
  const driverEarnings = roundMoney(
    bookings.reduce(
      (sum, booking) =>
        sum + driverEarningsForBooking(booking),
      0
    )
  );
  const unallocatedDriverEarnings = roundMoney(
    bookings.reduce(
      (sum, booking) =>
        sum +
        (booking.assignedDriverId
          ? 0
          : driverEarningsForBooking(booking)),
      0
    )
  );
  const driverPaid = roundMoney(
    payouts.reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0)
  );

  return {
    grossRevenue,
    driverEarnings,
    unallocatedDriverEarnings,
    driverPaid,
    pendingPayouts: roundMoney(Math.max(0, driverEarnings - driverPaid)),
    platformEarning: roundMoney(grossRevenue - driverEarnings),
  };
}

export async function buildDriverLedger(driverId, { visibleOnly = false } = {}) {
  const objectId = new mongoose.Types.ObjectId(driverId);
  const [bookings, payouts] = await Promise.all([
    Booking.find({
      assignedDriverId: objectId,
      status: "COMPLETED",
      ...(visibleOnly ? { driverAmount: { $ne: null } } : {}),
    })
      .select("pricing.totalFare driverAmount completedAt updatedAt")
      .lean(),
    Payout.find({ driverId: objectId, status: "PAID" }).lean(),
  ]);

  return [
    ...bookings.map((booking) => ({
      _id: `booking-${booking._id}`,
      type: "CREDIT",
      amount: driverEarningsForBooking(booking),
      referenceType: "BOOKING",
      referenceId: booking._id,
      note: booking.driverAmount != null ? "Agreed booking amount" : "80% booking earnings",
      createdAt: booking.completedAt || booking.updatedAt,
    })),
    ...payouts.map((payout) => ({
      _id: `payout-${payout._id}`,
      type: "DEBIT",
      amount: roundMoney(payout.amount),
      referenceType: "PAYOUT",
      referenceId: payout._id,
      note: payout.note || "Driver payout",
      createdAt: payout.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
