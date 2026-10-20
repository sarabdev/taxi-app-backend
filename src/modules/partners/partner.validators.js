import { z } from "zod";
import { PROPERTY_COUNTS, PROPERTY_TYPES } from "./partner.model.js";

const text = (max) => z.string().trim().max(max);
const requiredText = (max, label) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

export const commissionPercentSchema = z.coerce
  .number({ error: "Commission must be a number" })
  .min(0, "Commission cannot be negative")
  .max(100, "Commission cannot exceed 100%")
  .transform((value) => Math.round(value * 100) / 100);

const partnerDetailsShape = {
  companyName: requiredText(160, "Property / company"),
  contactName: requiredText(120, "Contact name"),
  position: text(120).optional().default(""),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address"),
  phone: text(40).optional().default(""),
  city: text(120).optional().default(""),
  propertyType: z.enum(PROPERTY_TYPES).optional().default("OTHER"),
  propertyCount: z.enum(PROPERTY_COUNTS).optional().default("1"),
  message: text(2000).optional().default(""),
};

/** Public partner enquiry from the website. */
export const partnerApplicationSchema = z.object({
  ...partnerDetailsShape,
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0, "Invalid submission").optional(),
});

/** Admin-created partner. Approved immediately. */
export const adminCreatePartnerSchema = z.object({
  ...partnerDetailsShape,
  commissionPercent: commissionPercentSchema.optional(),
  adminNotes: text(2000).optional().default(""),
  sendEmail: z.boolean().optional().default(true),
});

/** Admin edit. Every field optional; referral code and status are not editable here. */
export const adminUpdatePartnerSchema = z
  .object({
    companyName: requiredText(160, "Property / company"),
    contactName: requiredText(120, "Contact name"),
    position: text(120),
    email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address"),
    phone: text(40),
    city: text(120),
    propertyType: z.enum(PROPERTY_TYPES),
    propertyCount: z.enum(PROPERTY_COUNTS),
    message: text(2000),
    commissionPercent: commissionPercentSchema,
    adminNotes: text(2000),
  })
  .partial();

export const approvePartnerSchema = z.object({
  commissionPercent: commissionPercentSchema.optional(),
});

/** Parses `body` with `schema`, throwing an Error with the first readable message. */
export function parseOrThrow(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || "Invalid request");
    error.status = 400;
    throw error;
  }
  return result.data;
}
