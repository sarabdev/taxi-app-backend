import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  applyAsPartner,
  approve,
  createPartner,
  getReferral,
  listPartnerBookings,
  listPartners,
  reject,
  resendLink,
  suspend,
  updatePartner,
} from "./partner.controller.js";

export const partnerRouter = Router();

// Public (customer website)
partnerRouter.post("/apply", applyAsPartner);
partnerRouter.get("/referral/:code", getReferral);

// Admin
const admin = [auth, requireRole("ADMIN")];
partnerRouter.get("/", ...admin, listPartners);
partnerRouter.post("/", ...admin, createPartner);
partnerRouter.patch("/:id", ...admin, updatePartner);
partnerRouter.post("/:id/approve", ...admin, approve);
partnerRouter.post("/:id/reject", ...admin, reject);
partnerRouter.post("/:id/suspend", ...admin, suspend);
partnerRouter.post("/:id/resend-link", ...admin, resendLink);
partnerRouter.get("/:id/bookings", ...admin, listPartnerBookings);
