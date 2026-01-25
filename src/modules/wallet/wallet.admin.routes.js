import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Driver } from "../drivers/driver.model.js";
import { WalletTransaction } from "./wallet.model.js";
import { getWalletBalance } from "./wallet.service.js";
import { Booking } from "../bookings/booking.model.js";
export const walletAdminRouter = Router();

walletAdminRouter.get(
  "/admin/summary",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    /* ===============================
     * 1️⃣ DRIVERS
     * =============================== */
    const drivers = await Driver.find()
      .populate("userId", "email")
      .lean();

    /* ===============================
     * 2️⃣ WALLET AGG (DRIVER SIDE)
     * =============================== */
    const walletAgg = await WalletTransaction.aggregate([
      {
        $match: {
          driverId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$driverId",
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

    const walletMap = {};
    for (const w of walletAgg) {
      walletMap[w._id.toString()] = w;
    }

    /* ===============================
     * 3️⃣ DRIVER RESULT
     * =============================== */
    const driverStats = drivers.map((d) => {
      const wallet = walletMap[d._id.toString()] || {
        earned: 0,
        paid: 0,
      };

      const balance = wallet.earned - wallet.paid;

      return {
        driverId: d._id,
        name: d.name,
        email: d.userId?.email || null,
        earned: Number(wallet.earned.toFixed(2)),
        paid: Number(wallet.paid.toFixed(2)),
        balance: Number(balance.toFixed(2)),
      };
    });

    /* ===============================
     * 4️⃣ ADMIN / PLATFORM EARNINGS
     * =============================== */
    const completedBookings = await Booking.find({
      status: "COMPLETED",
    }).lean();

    let grossRevenue = 0;
    let driverPaid = 0;

    for (const b of completedBookings) {
      const total = Number(b.pricing?.totalFare || 0);
      grossRevenue += total;
      driverPaid += Number((total * 0.8).toFixed(2));
    }

    const platformEarning = grossRevenue - driverPaid;

    /* ===============================
     * 5️⃣ RESPONSE
     * =============================== */
    res.json({
      admin: {
        grossRevenue: Number(grossRevenue.toFixed(2)),
        driverPaid: Number(driverPaid.toFixed(2)),
        platformEarning: Number(platformEarning.toFixed(2)),
      },
      drivers: driverStats,
    });
  }
);

// Admin: ledger for a specific driver
walletAdminRouter.get(
  "/admin/:driverId",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    const { driverId } = req.params;
    const balance = await getWalletBalance(driverId);

    const transactions = await WalletTransaction.find({ driverId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ balance, transactions });
  }
);
