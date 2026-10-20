import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
      unique: true,
      immutable: true,
    },
    meetAndGreetPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    airportPickupFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Commission offered to newly approved partners; each partner can override it.
    defaultPartnerCommissionPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", SettingsSchema);
