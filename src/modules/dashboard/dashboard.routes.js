import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Booking } from "../bookings/booking.model.js";
import { WalletTransaction } from "../wallet/wallet.model.js";
import { Driver } from "../drivers/driver.model.js";
export const dashboardRouter = Router();

dashboardRouter.get(
  "/admin",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      /* ─────────────────────────────
       * BOOKINGS METRICS
       * ───────────────────────────── */
      const [
        bookingsToday,
        completedBookings,
        pendingBookings,
      ] = await Promise.all([
        Booking.countDocuments({
          createdAt: { $gte: startOfDay },
        }),

        Booking.countDocuments({
          status: "COMPLETED",
        }),

        Booking.countDocuments({
          status: { $in: ["PENDING", "ASSIGNED"] },
        }),
      ]);

      /* ─────────────────────────────
       * REVENUE (LOCKED PRICING)
       * ───────────────────────────── */
      const revenueAgg = await Booking.aggregate([
        { $match: { status: "COMPLETED" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$pricing.totalFare" },
          },
        },
      ]);

      const totalRevenue = revenueAgg[0]?.total || 0;

      /* ─────────────────────────────
       * DRIVER EARNINGS (CREDIT)
       * ───────────────────────────── */
      const earningsAgg = await WalletTransaction.aggregate([
        { $match: { type: "CREDIT" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      const totalDriverEarnings = earningsAgg[0]?.total || 0;

      /* ─────────────────────────────
       * PENDING PAYOUTS (WALLET BALANCE)
       * ───────────────────────────── */
      const walletAgg = await WalletTransaction.aggregate([
        {
          $group: {
            _id: "$driverId",
            balance: {
              $sum: {
                $cond: [
                  { $eq: ["$type", "CREDIT"] },
                  "$amount",
                  { $multiply: ["$amount", -1] },
                ],
              },
            },
          },
        },
        { $match: { balance: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            total: { $sum: "$balance" },
          },
        },
      ]);

      const pendingPayouts = walletAgg[0]?.total || 0;

      /* ─────────────────────────────
       * ADMIN EARNING (PLATFORM CUT)
       * ─────────────────────────────
       * Assumption: drivers get 80%
       * Admin keeps 20%
       */
      const adminEarnings = Number(
        (totalRevenue - totalDriverEarnings).toFixed(2)
      );

      res.json({
        bookingsToday,
        completedBookings,
        pendingBookings,

        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalDriverEarnings: Number(totalDriverEarnings.toFixed(2)),
        adminEarnings,

        pendingPayouts: Number(pendingPayouts.toFixed(2)),
      });
    } catch (err) {
      console.error("Dashboard analytics error:", err);
      res.status(500).json({ message: "Failed to load dashboard analytics" });
    }
  }
);


dashboardRouter.get(
  "/driver",
  auth,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      // 1️⃣ Find driver profile
      const driver = await Driver.findOne({ userId: req.user.id });
      if (!driver) {
        return res.json({
          assignedBookings: 0,
          completedBookings: 0,
          bookingsToday: 0,
          totalEarned: 0,
          totalPaid: 0,
          balance: 0,
        });
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      /* ─────────────────────────────
       * BOOKINGS
       * ───────────────────────────── */
      const [
        assignedBookings,
        completedBookings,
        bookingsToday,
      ] = await Promise.all([
        Booking.countDocuments({
          assignedDriverId: driver._id,
          status: "ASSIGNED",
        }),

        Booking.countDocuments({
          assignedDriverId: driver._id,
          status: "COMPLETED",
        }),

        Booking.countDocuments({
          assignedDriverId: driver._id,
          createdAt: { $gte: startOfDay },
        }),
      ]);

      /* ─────────────────────────────
       * WALLET
       * ───────────────────────────── */
      const walletAgg = await WalletTransaction.aggregate([
        { $match: { driverId: driver._id } },
        {
          $group: {
            _id: null,
            earned: {
              $sum: {
                $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0],
              },
            },
            paid: {
              $sum: {
                $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0],
              },
            },
          },
        },
      ]);

      const earned = walletAgg[0]?.earned || 0;
      const paid = walletAgg[0]?.paid || 0;

      res.json({
        assignedBookings,
        completedBookings,
        bookingsToday,
        totalEarned: Number(earned.toFixed(2)),
        totalPaid: Number(paid.toFixed(2)),
        balance: Number((earned - paid).toFixed(2)),
      });
    } catch (err) {
      console.error("Driver dashboard error:", err);
      res.status(500).json({ message: "Failed to load driver dashboard" });
    }
  }
);
