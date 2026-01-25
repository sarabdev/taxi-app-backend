import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  createDriver,
  updateDriver,
  toggleDriverStatus,
  deleteDriver,
} from "./driver.controller.js";
import { Driver } from "./driver.model.js";

export const driverRouter = Router();

/**
 * Create driver
 */
driverRouter.post(
  "/",
  auth,
  requireRole("ADMIN"),
  createDriver
);

/**
 * List drivers
 */
driverRouter.get(
  "/",
  auth,
  requireRole("ADMIN"),
  async (_, res) => {
    const drivers = await Driver.find()
      .populate("userId", "email role")
      .sort({ createdAt: -1 });

    res.json(drivers);
  }
);

/**
 * Update driver profile
 */
driverRouter.put(
  "/:id",
  auth,
  requireRole("ADMIN"),
  updateDriver
);

/**
 * Activate / Deactivate driver
 */
driverRouter.patch(
  "/:id/status",
  auth,
  requireRole("ADMIN"),
  toggleDriverStatus
);

/**
 * Delete driver (hard delete)
 */
driverRouter.delete(
  "/:id",
  auth,
  requireRole("ADMIN"),
  deleteDriver
);
