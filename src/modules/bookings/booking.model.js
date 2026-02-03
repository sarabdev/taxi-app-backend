import mongoose from "mongoose";

/* ───────────────────── Pricing (LOCKED snapshot) ───────────────────── */
const PricingSchema = new mongoose.Schema(
  {
    baseFare: {
      type: Number,
      required: true,
    },
    distanceMiles: {
      type: Number,
      required: true,
    },
    pricePerMile: {
      type: Number,
      required: true,
    },
    carDiscountAmount: {
      type: Number,
      default: 0,
    },
    couponDiscountAmount: {
      type: Number,
      default: 0,
    },
    totalFare: {
      type: Number,
      required: true,
    },
    appliedCoupon: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

/* ───────────────────── Luggage ───────────────────── */
const LuggageSchema = new mongoose.Schema(
  {
    largeBags23kg: {
      type: Number,
      default: 0,
    },
    smallBags15kg: {
      type: Number,
      default: 0,
    },
    extraLargeItemType: {
      type: String,
      enum: [
        "none",
        "extra_large_bag_35kg",
        "wheelchair",
        "pram",
        "golf_bag",
        "other",
      ],
      default: "none",
    },
    extraLargeItemNote: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

/* ───────────────────── Flight Info ───────────────────── */
const FlightSchema = new mongoose.Schema(
  {
    flightNumber: {
      type: String,
      default: "",
    },
    arrivingFrom: {
      type: String,
      default: "",
    },
    arrivalDateTime: {
      type: Date,
      default: null,
    },
    meetAndGreet: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/* ───────────────────── Booking ───────────────────── */
const BookingSchema = new mongoose.Schema(
  {
    /* Customer */
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },

    /* Route */
    pickupLocation: {
      type: String,
      required: true,
    },
    dropoffLocation: {
      type: String,
      required: true,
    },

    /* Car */
    carId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },

    /* Passenger */
    passengers: {
      type: Number,
      default: 1,
      min: 1,
    },

    /* Luggage */
    luggage: {
      type: LuggageSchema,
      default: () => ({}),
    },

    /* Flight */
    flight: {
      type: FlightSchema,
      default: () => ({}),
    },

    /* Booking lifecycle */
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

    /* 🔒 Locked pricing */
    pricing: {
      type: PricingSchema,
      required: true,
    },
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", BookingSchema);
