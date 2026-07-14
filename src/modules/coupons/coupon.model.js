import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

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
        message: "Percentage coupon cannot exceed 100%",
      },
    },

    minAmount: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },

    usageLimit: {
      type: Number,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Usage limit must be a whole number",
      },
    },
    // Kept for backward compatibility. Actual usage is derived from bookings.
    usedCount: { type: Number, default: 0, min: 0 },

    expiresAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model("Coupon", CouponSchema);
