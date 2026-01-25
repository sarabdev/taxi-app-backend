import mongoose from "mongoose";

const WalletTransactionSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    amount: { type: Number, required: true },

    referenceType: {
      type: String,
      enum: ["BOOKING", "PAYOUT"],
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    note: String,
  },
  { timestamps: true }
);

export const WalletTransaction = mongoose.model(
  "WalletTransaction",
  WalletTransactionSchema
);
