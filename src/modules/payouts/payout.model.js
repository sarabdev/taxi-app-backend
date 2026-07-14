import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },

    amount: { type: Number, required: true },

    method: {
      type: String,
      enum: ["BANK", "CASH", "OTHER"],
      default: "BANK",
    },

    status: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PAID",
    },

    requestId: {
      type: String,
      trim: true,
      maxlength: 100,
      unique: true,
      sparse: true,
    },

    reference: String, // e.g. bank transfer ref
    note: String,
  },
  { timestamps: true }
);

export const Payout = mongoose.model("Payout", PayoutSchema);
