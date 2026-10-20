import mongoose from "mongoose";

/* ───────────────────── Pricing (LOCKED snapshot) ───────────────────── */
const PricingSchema = new mongoose.Schema(
  {
    basePrice: {
      type: Number,
      default: 0,
    },
    baseFare: {
      type: Number,
      required: true,
    },
    returnBaseFare: {
      type: Number,
      default: 0,
    },
    distanceMiles: {
      type: Number,
      required: true,
    },
    returnDistanceMiles: {
      type: Number,
      default: 0,
    },
    pricePerMile: {
      type: Number,
      required: true,
    },
    returnPricePerMile: {
      type: Number,
      default: 0,
    },
    carDiscountAmount: {
      type: Number,
      default: 0,
    },
    couponDiscountAmount: {
      type: Number,
      default: 0,
    },
    meetAndGreetFee: {
      type: Number,
      default: 0,
    },
    airportPickupFee: {
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

/* ───────────────────── Intermediate stop ───────────────────── */
const StopSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      default: "",
    },
    placeId: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

/* ───────────────────── Referring partner ───────────────────── */
// Snapshot taken at booking time so later commission changes never rewrite
// what was earned on past rides.
const BookingPartnerSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },
    referralCode: { type: String, default: "" },
    companyName: { type: String, default: "" },
    commissionPercent: { type: Number, min: 0, max: 100, default: 0 },
    commissionAmount: { type: Number, min: 0, default: 0 },
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
    shoulderBags: {
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

/* ───────────────────── Return Trip Info ───────────────────── */
const ReturnTripSchema = new mongoose.Schema(
  {
    pickupLocation: {
      type: String,
      default: "",
    },
    pickupPlaceId: {
      type: String,
      default: "",
    },
    dropoffLocation: {
      type: String,
      default: "",
    },
    dropoffPlaceId: {
      type: String,
      default: "",
    },
    pickupDate: {
      type: String,
      default: "",
    },
    pickupTime: {
      type: String,
      default: "",
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
    pickupPlaceId: {
      type: String,
      default: "",
    },
    dropoffLocation: {
      type: String,
      required: true,
    },
    dropoffPlaceId: {
      type: String,
      default: "",
    },
    /* Ordered intermediate stops between pickup and drop-off */
    stops: {
      type: [StopSchema],
      default: [],
    },
    pickupDate: {
      type: String,
      default: "",
    },
    pickupTime: {
      type: String,
      default: "",
    },
    isReturnTrip: {
      type: Boolean,
      default: false,
    },
    returnTrip: {
      type: ReturnTripSchema,
      default: null,
    },

    /* Car */
    carId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },

    paymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
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

    completedAt: {
      type: Date,
      default: null,
    },

    /* 🔒 Locked pricing */
    pricing: {
      type: PricingSchema,
      required: true,
    },

    /* Partner whose referral link brought this booking, if any */
    partner: {
      type: BookingPartnerSchema,
      default: null,
    },
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", BookingSchema);
