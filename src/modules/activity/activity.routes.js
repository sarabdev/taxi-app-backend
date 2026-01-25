import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Activity } from "./activity.model.js";

export const activityRouter = Router();

activityRouter.get(
  "/booking/:bookingId",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    const logs = await Activity.find({
      entityType: "BOOKING",
      entityId: req.params.bookingId,
    }).sort({ createdAt: 1 });

    res.json(logs);
  }
);
