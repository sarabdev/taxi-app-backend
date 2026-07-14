import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    phone: String,
    licenseNumber: String,
    isActive: { type: Boolean, default: true },
    assignedCarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      default: null,
    },

    city: {
      type: String,
      trim: true,
      required: true,
    },

    homeAddress: {
      type: String,
      trim: true,
      required: true,
    },

    licenseDocument: {
      type: String,
      default: "",
    },

    payoutLockToken: {
      type: String,
      default: null,
      select: false,
    },
    payoutLockExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

export const Driver = mongoose.model("Driver", DriverSchema);
