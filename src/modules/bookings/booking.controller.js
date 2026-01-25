import { Booking } from "./booking.model.js";
import { Driver } from "../drivers/driver.model.js";
import { User } from "../users/user.model.js";
import { creditBookingOnce } from "../wallet/wallet.service.js";
import { logActivity } from "../activity/activity.service.js";
import { sendMail } from "../../utils/mailer.js";
import { driverAssignedEmail } from "../../emails/driverAssigned.js";
import { bookingCompletedEmail } from "../../emails/bookingCompleted.js";
import { WalletTransaction } from "../wallet/wallet.model.js";
/**
 * Admin: list all bookings
 */
export async function listBookings(req, res) {
  const bookings = await Booking.find()
    .populate({
      path: "assignedDriverId",
      populate: {
        path: "userId",
        select: "email",
      },
    })
    .sort({ createdAt: -1 });

  res.json(bookings);
}


/**
 * Admin: assign driver to booking
 */
export async function assignDriver(req, res) {
  const { driverId } = req.body;

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  booking.assignedDriverId = driverId;
  booking.status = "ASSIGNED";
  await booking.save();

  // 🧾 Activity log
  await logActivity({
    entityType: "BOOKING",
    entityId: booking._id,
    action: "ASSIGNED",
    performedByRole: "ADMIN",
    performedById: req.user.id,
    note: `Assigned driver ${driverId}`,
  });

  await WalletTransaction.updateOne(
  {
    referenceType: "BOOKING",
    referenceId: booking._id,
    driverId: null,
  },
  {
    $set: { driverId: driverId },
  }
);

  // 📧 Email driver (non-blocking)
  const driverUser = await User.findById(driverId);
  if (driverUser?.email) {
    const email = driverAssignedEmail({ booking });
    await sendMail({
      to: driverUser.email,
      subject: email.subject,
      html: email.html,
    });
  }

  res.json(booking);
}

/**
 * Admin / Driver: update booking status
 */
/**
 * Update booking status
 * - DRIVER can only COMPLETE their own booking
 * - ADMIN can update any status
 * - COMPLETED triggers wallet credit ONCE
 */
export async function updateStatus(req, res) {
  const { status, note } = req.body;
const booking = await Booking.findById(req.params.id)
  .populate("carId") // car details
  .populate({
    path: "assignedDriverId",
    populate: {
      path: "userId",
      select: "email role",
    },
  });
console.log(booking) 
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  /* ============================
   * 🔒 DRIVER ROLE GUARD
   * ============================ */
  if (req.user.role === "DRIVER") {
    console.log(booking.assignedDriverId?.toString())
    console.log(req.user.id)
    if (booking.assignedDriverId?.userId?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your booking" });
    }

    if (status !== "COMPLETED") {
      return res
        .status(403)
        .json({ message: "Drivers can only complete bookings" });
    }
  }

  /* ============================
   * 🛑 IDEMPOTENCY GUARD
   * ============================ */
  // if (booking.status === "COMPLETED") {
  //   return res.json(booking);
  // }

  booking.status = status;

  /* ============================
   * 💰 CREDIT DRIVER ON COMPLETION
   * ============================ */
  let driverShare = 0;

  if (status === "COMPLETED") {
    booking.completionNote = note || "";

    if (!booking.assignedDriverId) {
      return res
        .status(400)
        .json({ message: "Cannot complete booking without driver" });
    }

    const driver = await Driver.findOne({
      _id: booking.assignedDriverId,
    });
      console.log("I am here2")

    if (driver) {
      const totalFare = Number(booking.pricing?.totalFare || 0);
      driverShare = Number((totalFare * 0.8).toFixed(2)); // 80%

      // 🔒 WALLET IDEMPOTENCY CHECK
      const alreadyCredited = await WalletTransaction.findOne({
        referenceType: "BOOKING",
        referenceId: booking._id,
      });

      console.log("I am here", alreadyCredited)

      if (!alreadyCredited) {
        await WalletTransaction.create({
          driverId: driver._id,
          type: "CREDIT",
          amount: driverShare,
          referenceType: "BOOKING",
          referenceId: booking._id,
          note: "Booking completed payout",
        });
      }
    }
  }

  await booking.save();

  /* ============================
   * 🧾 ACTIVITY LOG
   * ============================ */
  await logActivity({
    entityType: "BOOKING",
    entityId: booking._id,
    action: status,
    performedByRole: req.user.role,
    performedById: req.user.id,
    note: note || "",
  });

  /* ============================
   * 📧 EMAIL DRIVER
   * ============================ */
  if (status === "COMPLETED" && booking.assignedDriverId) {
    const driverUser = await User.findById(booking.assignedDriverId);

    if (driverUser?.email) {
      const email = bookingCompletedEmail({
        booking,
        driverShare,
      });

      await sendMail({
        to: driverUser.email,
        subject: email.subject,
        html: email.html,
      });
    }
  }

  res.json(booking);
}
