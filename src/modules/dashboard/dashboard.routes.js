import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Booking } from "../bookings/booking.model.js";
import { Driver } from "../drivers/driver.model.js";
import {
  getDriverAccounting,
  getPlatformAccounting,
} from "../accounting/accounting.service.js";
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

      const accounting = await getPlatformAccounting();

      res.json({
        bookingsToday,
        completedBookings,
        pendingBookings,

        totalRevenue: accounting.grossRevenue,
        totalDriverEarnings: accounting.driverEarnings,
        totalDriverPaid: accounting.driverPaid,
        adminEarnings: accounting.platformEarning,
        pendingPayouts: accounting.pendingPayouts,
        unallocatedDriverEarnings: accounting.unallocatedDriverEarnings,
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

      const accounting = await getDriverAccounting(driver._id);

      res.json({
        assignedBookings,
        completedBookings,
        bookingsToday,
        totalEarned: accounting.earned,
        totalPaid: accounting.paid,
        balance: accounting.balance,
      });
    } catch (err) {
      console.error("Driver dashboard error:", err);
      res.status(500).json({ message: "Failed to load driver dashboard" });
    }
  }
);
