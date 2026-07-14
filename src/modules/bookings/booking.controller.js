import { Booking } from "./booking.model.js";
import { Driver } from "../drivers/driver.model.js";
import { User } from "../users/user.model.js";
import { logActivity } from "../activity/activity.service.js";
import { sendMail } from "../../utils/mailer.js";
import { driverAssignedEmail } from "../../emails/driverAssigned.js";
import { bookingCompletedEmail } from "../../emails/bookingCompleted.js";
import { customerBookingCompletedEmail } from "../../emails/customerBookingCompleted.js";
import { adminBookingCompletedEmail } from "../../emails/adminBookingCompleted.js";
import {
  driverShareForFare,
  platformShareForFare,
} from "../accounting/accounting.service.js";

const BOOKING_STATUSES = new Set([
  "PENDING",
  "ASSIGNED",
  "COMPLETED",
  "CANCELLED",
]);

function populatedBooking(id) {
  return Booking.findById(id)
    .populate("carId")
    .populate({
      path: "assignedDriverId",
      populate: { path: "userId", select: "email role" },
    });
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
  const driver = await Driver.findById(driverId).populate("userId", "email");

  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, status: { $ne: "COMPLETED" } },
    { $set: { assignedDriverId: driver._id, status: "ASSIGNED" } },
    { new: true, runValidators: true }
  );

  if (!booking) {
    const exists = await Booking.exists({ _id: req.params.id });
    return res.status(exists ? 409 : 404).json({
      message: exists
        ? "A completed booking cannot be reassigned"
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

  if (driver.userId?.email) {
    const email = driverAssignedEmail({ booking });
    try {
      await sendMail({
        to: driver.userId.email,
        subject: email.subject,
        html: email.html,
      });
    } catch (error) {
      console.error("Driver assignment email failed:", error);
    }
  }

  res.json(booking);
}

/**
 * Admin / driver status update.
 * COMPLETED is terminal because it recognizes revenue and driver earnings.
 */
export async function updateStatus(req, res) {
  const { status, note } = req.body;
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
    if (status !== "COMPLETED") {
      return res
        .status(403)
        .json({ message: "Drivers can only complete bookings" });
    }
  }

  if (current.status === "COMPLETED") {
    if (status === "COMPLETED") return res.json(current);
    return res.status(409).json({
      message: "Completed bookings are locked and cannot change status",
    });
  }

  if (status === "COMPLETED" && !current.assignedDriverId) {
    return res
      .status(400)
      .json({ message: "Cannot complete booking without a driver" });
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
  };

  let booking = await Booking.findOneAndUpdate(
    {
      _id: current._id,
      status: current.status,
      assignedDriverId: current.assignedDriverId?._id || null,
    },
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!booking) {
    booking = await populatedBooking(current._id);
    if (booking?.status === "COMPLETED" && status === "COMPLETED") {
      return res.json(booking);
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
    booking = await populatedBooking(booking._id);
    const driverShare = driverShareForFare(booking.pricing?.totalFare);
    const platformShare = platformShareForFare(booking.pricing?.totalFare);
    const driverEmail = booking.assignedDriverId?.userId?.email;
    const emails = [];

    if (driverEmail) {
      const email = bookingCompletedEmail({ booking, driverShare });
      emails.push(
        sendMail({
          to: driverEmail,
          subject: email.subject,
          html: email.html,
        })
      );
    }

    if (booking.customerEmail) {
      const email = customerBookingCompletedEmail({ booking });
      emails.push(
        sendMail({
          to: booking.customerEmail,
          subject: email.subject,
          html: email.html,
        })
      );
    }

    let adminEmails = [];
    try {
      adminEmails = await User.find({
        role: "ADMIN",
        isActive: true,
      }).distinct("email");
    } catch (error) {
      console.error("Unable to load admin email recipients:", error);
    }
    const adminEmail = adminBookingCompletedEmail({
      booking,
      driverShare,
      platformShare,
    });
    for (const address of adminEmails) {
      emails.push(
        sendMail({
          to: address,
          subject: adminEmail.subject,
          html: adminEmail.html,
        })
      );
    }

    await Promise.all(emails);
  }

  res.json(booking);
}
