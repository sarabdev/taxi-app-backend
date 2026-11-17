import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  createDriver,
  updateDriver,
  toggleDriverStatus,
  deleteDriver,
} from "./driver.controller.js";
import { uploadDriverDocuments } from "../../middleware/driverLicenseUpload.js";
import { Driver } from "./driver.model.js";

export const driverRouter = Router();

function parseDriverDocument(req, res, next) {
  uploadDriverDocuments.single("licenseDocument")(req, res, (error) => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      message: error.code === "LIMIT_FILE_SIZE" ? "License document must be 5 MB or smaller" : error.message,
    });
    next();
  });
}

/**
 * Create driver
 */
driverRouter.post(
  "/",
  auth,
  requireRole("ADMIN"),
  parseDriverDocument,
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
      .populate("assignedCarId")
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
  parseDriverDocument,
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
