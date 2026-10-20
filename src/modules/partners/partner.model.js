import mongoose from "mongoose";

export const PARTNER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export const PROPERTY_TYPES = [
  "HOTEL",
  "GUEST_HOUSE",
  "LODGE",
  "HOLIDAY_RENTAL",
  "SERVICED_APARTMENTS",
  "OTHER",
];

export const PROPERTY_COUNTS = ["1", "2-5", "6-20", "21-50", "51+"];

const PartnerSchema = new mongoose.Schema(
  {
    /* Applicant / business details */
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    position: { type: String, trim: true, maxlength: 120, default: "" },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    city: { type: String, trim: true, maxlength: 120, default: "" },
    propertyType: { type: String, enum: PROPERTY_TYPES, default: "OTHER" },
    propertyCount: { type: String, enum: PROPERTY_COUNTS, default: "1" },
    message: { type: String, trim: true, maxlength: 2000, default: "" },

    /* Programme */
    status: { type: String, enum: PARTNER_STATUSES, default: "PENDING" },
    source: { type: String, enum: ["WEBSITE", "ADMIN"], default: "WEBSITE" },
    // Assigned on first approval and never changed, because printed QR codes and
    // shared links depend on it.
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    commissionPercent: { type: Number, min: 0, max: 100, default: null },
    adminNotes: { type: String, trim: true, maxlength: 2000, default: "" },

    approvedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PartnerSchema.index({ status: 1, createdAt: -1 });
PartnerSchema.index({ email: 1 });

export const Partner = mongoose.model("Partner", PartnerSchema);
