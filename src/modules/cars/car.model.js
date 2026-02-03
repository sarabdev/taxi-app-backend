import mongoose from "mongoose";

/* ───────────────────── Capacity ───────────────────── */
const CapacitySchema = new mongoose.Schema(
  {
    passengers: { type: Number, default: 0 },
    luggage: { type: Number, default: 0 },
  },
  { _id: false }
);

/* ───────────────────── Discount ───────────────────── */
const DiscountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    condition: {
      type: String,
      enum: ["RETURN_TRIP", "ALWAYS"],
      default: "ALWAYS",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/* ───────────────────── Airport Rate ───────────────────── */
/**
 * Stored as:
 * airportRates: {
 *   "<google_place_id>": { pricePerMile: 2.5 }
 * }
 */
const AirportRateSchema = new mongoose.Schema(
  {
    pricePerMile: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/* ───────────────────── Car ───────────────────── */
const CarSchema = new mongoose.Schema(
  {
    /* Basic Info */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "salon_car",
        "executive_car",
        "estate_car",
        "people_carrier",
        "executive_people_carrier",
        "minibus_8_seater",
      ],
    },

    image: {
      type: String,
      default: "",
    },

    /* Capacity */
    capacity: {
      type: CapacitySchema,
      default: () => ({ passengers: 0, luggage: 0 }),
    },

    /* Base Pricing */
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    /* Airport-based Per-Mile Pricing */
    airportRates: {
      type: Map,
      of: AirportRateSchema,
      default: {},
    },

    /* Meta */
    features: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      default: "",
    },

    /* Discounts */
    discounts: {
      type: [DiscountSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Car = mongoose.model("Car", CarSchema);
