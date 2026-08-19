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
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", SettingsSchema);
