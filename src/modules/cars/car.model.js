import mongoose from "mongoose";

const CapacitySchema = new mongoose.Schema(
  {
    passengers: Number,
    luggage: Number,
  },
  { _id: false }
);

const DiscountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
    },
    value: Number,
    condition: {
      type: String,
      enum: ["RETURN_TRIP", "ALWAYS"],
      default: "ALWAYS",
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const CarSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }, // sedan, suv, luxury
    image: String,

    capacity: CapacitySchema,

    pricePerMile: Number,
    basePrice: Number,

    features: [String],
    description: String,

    discounts: [DiscountSchema], // 👈 best-practice
  },
  { timestamps: true }
);

export const Car = mongoose.model("Car", CarSchema);
