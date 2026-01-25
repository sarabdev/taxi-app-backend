import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { createBooking } from "./booking.create.controller.js";
import {
  listBookings,
  assignDriver,
  updateStatus,
} from "./booking.controller.js";
import { Booking } from "./booking.model.js";
import { Driver } from "../drivers/driver.model.js";
export const bookingRouter = Router();

// Public (customer website)
bookingRouter.post("/", createBooking);

// Admin
bookingRouter.get("/", auth, requireRole("ADMIN"), listBookings);
bookingRouter.patch("/:id/assign", auth, requireRole("ADMIN"), assignDriver);
bookingRouter.patch("/:id/status", auth, requireRole("ADMIN", "DRIVER"), updateStatus);
bookingRouter.get(
  "/me",
  auth,
  requireRole("DRIVER"),
  async (req, res) => {
    // 1️⃣ Find driver profile linked to logged-in user
    const driver = await Driver.findOne({ userId: req.user.id });

    if (!driver) {
      return res.json([]); // driver profile not created yet
    }

    // 2️⃣ Fetch bookings assigned to this driver
    const bookings = await Booking.find({
      assignedDriverId: driver._id,
    })
      .populate("carId")
      .sort({ createdAt: -1 });

    res.json(bookings);
  }
);


bookingRouter.get(
  "/:id",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .populate("carId")
        .populate({
          path: "assignedDriverId",
          populate: {
            path: "userId",
            select: "email",
          },
        });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json(booking);
    } catch (err) {
      console.error("Fetch booking failed:", err);
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  }
);

