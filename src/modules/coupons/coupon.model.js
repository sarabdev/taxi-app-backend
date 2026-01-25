import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, uppercase: true },

    type: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },

    value: { type: Number, required: true },

    minAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },

    usageLimit: { type: Number }, // optional global limit
    usedCount: { type: Number, default: 0 },

    expiresAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model("Coupon", CouponSchema);
