import { Booking } from "./booking.model.js";
import { Driver } from "../drivers/driver.model.js";
import { logActivity } from "../activity/activity.service.js";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { verifyAccessLink } from "../../utils/accessLinks.js";
import { driverBooking, parseDriverAmount } from "./driverBooking.js";
import { bookingEmailPopulation, queueBookingNotifications } from "./booking.notifications.js";
import {
  MAX_COMPLETION_CODE_ATTEMPTS,
  completionCodeMatches,
} from "./completionCode.js";

const BOOKING_STATUSES = new Set([
  "PENDING",
  "ASSIGNED",
  "COMPLETED",
  "CANCELLED",
]);
function populatedBooking(id) {
  return Booking.findById(id)
    .select("+completionCode +notificationPending +driverAccessNonce")
    .populate(bookingEmailPopulation);
}

/** Partner commission is internal, so it is removed from responses to drivers. */
function bookingForRole(booking, role) {
  if (!booking) return booking;
  if (role === "DRIVER") return driverBooking(booking);
  const { driverAccessNonce, notificationPending, ...visible } = booking.toObject ? booking.toObject() : booking;
  return visible;
}

/** Admin: list all bookings. */
export async function listBookings(req, res) {
  const bookings = await Booking.find()
    .populate({
      path: "assignedDriverId",
      populate: { path: "userId", select: "email" },
    })
    .sort({ createdAt: -1 });

  res.json(bookings);
}

/** Admin: assign a driver to a non-completed booking. */
export async function assignDriver(req, res) {
  const { driverId } = req.body;
  if (!mongoose.isValidObjectId(driverId) || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking or driver" });
  let driverAmount;
  try { driverAmount = parseDriverAmount(req.body.driverAmount); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  const driver = await Driver.findById(driverId).populate("userId", "email isActive");

  if (!driver || driver.isActive === false) {
    return res.status(404).json({ message: "Driver not found" });
  }
  if (!driver.userId?.email || driver.userId.isActive === false) return res.status(400).json({ message: "This driver needs an active account with an email address before assignment" });

  const nonce = randomBytes(24).toString("hex");
  let booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ["PENDING", "ASSIGNED"] } },
    { $set: { assignedDriverId: driver._id, status: "ASSIGNED", driverAmount, driverAccessNonce: nonce, "notificationPending.assignment": nonce } },
    { new: true, runValidators: true }
  );

  if (!booking) {
    const exists = await Booking.exists({ _id: req.params.id });
    return res.status(exists ? 409 : 404).json({
      message: exists
        ? "Only pending or assigned bookings can be assigned"
        : "Booking not found",
    });
  }

  try {
    await logActivity({
      entityType: "BOOKING",
      entityId: booking._id,
      action: "ASSIGNED",
      performedByRole: "ADMIN",
      performedById: req.user.id,
      note: `Assigned driver ${driver._id}`,
    });
  } catch (error) {
    console.error("Assignment activity log failed:", error);
  }

  // Populate the document returned by this atomic assignment. Re-reading it
  // could pick up a different driver's amount during concurrent reassignment.
  booking = await Booking.populate(booking, bookingEmailPopulation);
  await queueBookingNotifications(booking, "assignment", nonce);

  res.json(bookingForRole(booking, "ADMIN"));
}

/**
 * Admin / driver status update.
 * COMPLETED is terminal because it recognizes revenue and driver earnings.
 */
export async function updateStatus(req, res) {
  const { status, completionCode } = req.body;
  const note = typeof req.body.note === "string" ? req.body.note.slice(0, 2000) : "";
  if (!BOOKING_STATUSES.has(status)) {
    return res.status(400).json({ message: "Invalid booking status" });
  }

  const current = await populatedBooking(req.params.id);
  if (!current) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (req.user.role === "DRIVER") {
    if (current.assignedDriverId?.userId?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your booking" });
    }
    if (current.assignedDriverId.isActive === false || current.assignedDriverId.userId?.isActive === false ||
        (req.driverAccessNonce && req.driverAccessNonce !== current.driverAccessNonce)) {
      return res.status(403).json({ message: "This driver assignment is no longer active" });
    }
    if (status !== "COMPLETED") {
      return res
        .status(403)
        .json({ message: "Drivers can only complete bookings" });
    }
    if (!["ASSIGNED", "COMPLETED"].includes(current.status)) return res.status(409).json({ message: "Only an assigned ride can be completed" });
  }

  if (current.status === "COMPLETED") {
    if (status === "COMPLETED") {
      if (current.notificationPending?.completed) await queueBookingNotifications(current, "completed");
      return res.json(bookingForRole(current, req.user.role));
    }
    return res.status(409).json({
      message: "Completed bookings are locked and cannot change status",
    });
  }

  if (status === "COMPLETED" && !current.assignedDriverId) {
    return res
      .status(400)
      .json({ message: "Cannot complete booking without a driver" });
  }

  // Drivers must enter the customer's job-end code. Admins can override.
  // Bookings created before codes existed have none and skip this check.
  if (req.user.role === "DRIVER" && status === "COMPLETED") {
    const secret = await Booking.findById(current._id)
      .select("+completionCode")
      .lean();

    if (secret?.completionCode) {
      // Reserve one attempt atomically before checking, so parallel guesses
      // can never get past the limit.
      const attempt = await Booking.findOneAndUpdate(
        {
          _id: current._id,
          completionCodeAttempts: { $lt: MAX_COMPLETION_CODE_ATTEMPTS },
        },
        { $inc: { completionCodeAttempts: 1 } },
        { new: true, projection: { completionCodeAttempts: 1 } }
      ).lean();

      if (!attempt) {
        return res.status(423).json({
          message:
            "Too many wrong codes. Please contact the office to complete this ride.",
        });
      }

      if (!completionCodeMatches(secret.completionCode, completionCode)) {
        const left = Math.max(
          0,
          MAX_COMPLETION_CODE_ATTEMPTS - (attempt.completionCodeAttempts || 0)
        );
        return res.status(400).json({
          message: left
            ? `Wrong job-end code. ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Too many wrong codes. Please contact the office to complete this ride.",
        });
      }
    }
  }

  if (status === "ASSIGNED" && !current.assignedDriverId) {
    return res
      .status(400)
      .json({ message: "Assign a driver before using ASSIGNED status" });
  }

  const update = {
    status,
    completionNote: status === "COMPLETED" ? note || "" : "",
    completedAt: status === "COMPLETED" ? new Date() : null,
    ...(status === "COMPLETED" ? { "notificationPending.completed": true } : {}),
  };

  let booking = await Booking.findOneAndUpdate(
    {
      _id: current._id,
      status: current.status,
      assignedDriverId: current.assignedDriverId?._id || null,
      ...(req.driverAccessNonce ? { driverAccessNonce: req.driverAccessNonce } : {}),
    },
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!booking) {
    booking = await populatedBooking(current._id);
    if (req.user.role === "DRIVER" && (booking?.assignedDriverId?.userId?._id?.toString() !== req.user.id ||
        (req.driverAccessNonce && req.driverAccessNonce !== booking?.driverAccessNonce))) {
      return res.status(403).json({ message: "This driver assignment is no longer active" });
    }
    if (booking?.status === "COMPLETED" && status === "COMPLETED") {
      if (booking.notificationPending?.completed) await queueBookingNotifications(booking, "completed");
      return res.json(bookingForRole(booking, req.user.role));
    }
    return res.status(409).json({
      message: "Booking changed while updating. Refresh and try again.",
    });
  }

  try {
    await logActivity({
      entityType: "BOOKING",
      entityId: booking._id,
      action: status,
      performedByRole: req.user.role,
      performedById: req.user.id,
      note: note || "",
    });
  } catch (error) {
    console.error("Booking status activity log failed:", error);
  }

  if (status === "COMPLETED") {
    booking = await Booking.populate(booking, bookingEmailPopulation);
    await queueBookingNotifications(booking, "completed");
  }

  res.json(bookingForRole(booking, req.user.role));
}

// A private email link grants access only to this ride and its current driver.
export async function driverLinkAuth(req, res, next) {
  res.set("Cache-Control", "no-store");
  let claims;
  try { claims = verifyAccessLink(String(req.headers.authorization || "").replace(/^Bearer /, ""), "driver-completion"); }
  catch { return res.status(401).json({ message: "Invalid or expired ride link. Contact the office for a new assignment email." }); }
  if (!mongoose.isValidObjectId(claims.sub)) return res.status(401).json({ message: "Invalid ride link" });
  const booking = await Booking.findById(claims.sub).select("+driverAccessNonce +completionCode").populate("carId");
  if (!booking || String(booking.assignedDriverId) !== claims.driverId || !booking.driverAccessNonce || booking.driverAccessNonce !== claims.nonce) {
    return res.status(401).json({ message: "This ride link is no longer active. Contact the office." });
  }
  const driver = await Driver.findById(claims.driverId).populate("userId", "email isActive");
  if (!driver?.userId || driver.isActive === false || driver.userId.isActive === false) return res.status(403).json({ message: "Driver access is unavailable" });
  req.user = { id: String(driver.userId._id), role: "DRIVER" };
  req.params.id = String(booking._id);
  req.driverAccessNonce = claims.nonce;
  req.linkBooking = booking;
  next();
}

export function getDriverLinkBooking(req, res) { res.json(driverBooking(req.linkBooking)); }

export function completeViaDriverLink(req, res) {
  req.body = { status: "COMPLETED", completionCode: req.body.completionCode, note: req.body.note };
  return updateStatus(req, res);
}
