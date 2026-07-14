import { Router } from "express";
import mongoose from "mongoose";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Driver } from "../drivers/driver.model.js";
import {
  buildDriverLedger,
  getDriverAccounting,
  getPlatformAccounting,
} from "../accounting/accounting.service.js";

export const walletAdminRouter = Router();

walletAdminRouter.get(
  "/admin/summary",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    const drivers = await Driver.find()
      .populate("userId", "email")
      .lean();

    const [platform, driverStats] = await Promise.all([
      getPlatformAccounting(),
      Promise.all(
        drivers.map(async (driver) => {
          const accounting = await getDriverAccounting(driver._id);
          return {
            driverId: driver._id,
            name: driver.name,
            email: driver.userId?.email || null,
            ...accounting,
          };
        })
      ),
    ]);

    res.json({ admin: platform, drivers: driverStats });
  }
);

walletAdminRouter.get(
  "/admin/:driverId",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.driverId)) {
      return res.status(400).json({ message: "Invalid driver ID" });
    }

    const [accounting, transactions] = await Promise.all([
      getDriverAccounting(req.params.driverId),
      buildDriverLedger(req.params.driverId),
    ]);

    res.json({ balance: accounting.balance, transactions });
  }
);
