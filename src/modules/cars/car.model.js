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
      min: 0,
      validate: {
        validator(value) {
          return this.type !== "PERCENTAGE" || value <= 100;
        },
        message: "Percentage discount cannot exceed 100",
      },
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

/* ───────────────────── Airport distance bands ───────────────────── */
const DistanceBandSchema = new mongoose.Schema(
  {
    upToMiles: { type: Number, default: null, min: 0.01 },
    pricePerMile: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { _id: false }
);

function validDistanceBands(bands) {
  if (!Array.isArray(bands) || bands.length === 0) return false;
  if (bands[bands.length - 1].upToMiles != null) return false;

  return bands.every((band, index) => {
    const price = Number(band.pricePerMile);
    const limit = band.upToMiles == null ? null : Number(band.upToMiles);
    const previous = index > 0 ? bands[index - 1].upToMiles : 0;

    if (!Number.isFinite(price) || price <= 0) return false;
    if (limit === null) return index === bands.length - 1;
    return Number.isFinite(limit) && limit > Number(previous || 0);
  });
}

const AirportPricingSchema = new mongoose.Schema(
  {
    bands: {
      type: [DistanceBandSchema],
      required: true,
      validate: {
        validator: validDistanceBands,
        message: "Distance bands must have increasing limits and end with an unlimited band",
      },
    },
  },
  { _id: false }
);

const defaultAirportPricing = () => ({
  EDI: {
    bands: [
      { upToMiles: 10, pricePerMile: 3 },
      { upToMiles: null, pricePerMile: 3 },
    ],
  },
  GLA: {
    bands: [
      { upToMiles: 10, pricePerMile: 3 },
      { upToMiles: null, pricePerMile: 3 },
    ],
  },
});

const ScotlandPricingSchema = new mongoose.Schema(
  {
    EDI: { type: AirportPricingSchema, required: true },
    GLA: { type: AirportPricingSchema, required: true },
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

    /* Edinburgh/Glasgow distance-band pricing */
    airportPricing: {
      type: ScotlandPricingSchema,
      default: defaultAirportPricing,
      required: true,
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
