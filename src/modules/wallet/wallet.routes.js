import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Driver } from "../drivers/driver.model.js";
import {
  buildDriverLedger,
  getDriverAccounting,
} from "../accounting/accounting.service.js";

export const walletRouter = Router();

walletRouter.get(
  "/me",
  auth,
  requireRole("DRIVER"),
  async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user.id });
    if (!driver) return res.json({ balance: 0, transactions: [] });

    const [accounting, transactions] = await Promise.all([
      getDriverAccounting(driver._id),
      buildDriverLedger(driver._id),
    ]);

    res.json({ balance: accounting.balance, transactions });
  }
);
