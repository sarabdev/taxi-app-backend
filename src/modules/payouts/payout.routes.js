import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  adminListPayouts,
  adminCreatePayout,
  driverMyPayouts,
} from "./payout.controller.js";

export const payoutRouter = Router();

// Admin
payoutRouter.get("/admin", auth, requireRole("ADMIN"), adminListPayouts);
payoutRouter.post("/admin", auth, requireRole("ADMIN"), adminCreatePayout);

// Driver
payoutRouter.get("/me", auth, requireRole("DRIVER"), driverMyPayouts);
