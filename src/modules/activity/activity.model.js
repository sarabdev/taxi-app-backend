import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["BOOKING", "PAYOUT"],
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    action: {
      type: String,
      required: true, // ASSIGNED, COMPLETED, CANCELLED
    },

    performedByRole: {
      type: String,
      enum: ["ADMIN", "DRIVER"],
      required: true,
    },

    performedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    note: String,
  },
  { timestamps: true }
);

export const Activity = mongoose.model("Activity", ActivitySchema);
