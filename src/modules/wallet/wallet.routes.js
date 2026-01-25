import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getWalletBalance } from "./wallet.service.js";
import { Driver } from "../drivers/driver.model.js";
import { WalletTransaction } from "./wallet.model.js";

export const walletRouter = Router();

walletRouter.get(
  "/me",
  auth,
  requireRole("DRIVER"),
  async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user.id });
    if (!driver) return res.json({ balance: 0, transactions: [] });

    const balance = await getWalletBalance(driver._id);
    const transactions = await WalletTransaction.find({
      driverId: driver._id,
    }).sort({ createdAt: -1 });

    res.json({ balance, transactions });
  }
);
