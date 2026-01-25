import mongoose from "mongoose";

const PricingSchema = new mongoose.Schema(
  {
    baseFare: Number,
    distanceMiles: Number,
    pricePerMile: Number,
    carDiscountAmount: Number,
    couponDiscountAmount: Number,
    totalFare: Number,
    appliedCoupon: String,
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    pickupLocation: String,
    dropoffLocation: String,

    carId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "ASSIGNED", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },

    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    completionNote: {
      type: String,
      default: "",
     },

    pricing: PricingSchema,
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", BookingSchema);
