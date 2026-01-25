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
  },
  { timestamps: true }
);

export const Driver = mongoose.model("Driver", DriverSchema);
