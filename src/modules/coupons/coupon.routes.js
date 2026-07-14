import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Coupon } from "./coupon.model.js";
import {
  couponsWithUsage,
  findValidCoupon,
  normalizeCouponCode,
} from "./coupon.service.js";

export const couponRouter = Router();

const EDITABLE_FIELDS = [
  "code",
  "type",
  "value",
  "minAmount",
  "maxDiscount",
  "usageLimit",
  "expiresAt",
  "isActive",
];

function couponPayload(body) {
  const payload = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  if (payload.code !== undefined) {
    payload.code = normalizeCouponCode(payload.code);
  }
  return payload;
}

function couponError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({ message: "Coupon code already exists" });
  }
  return res.status(400).json({ message: error.message || "Invalid coupon" });
}

couponRouter.post("/", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const coupon = await Coupon.create(couponPayload(req.body));
    res.json(coupon);
  } catch (error) {
    couponError(res, error);
  }
});

couponRouter.get("/", auth, requireRole("ADMIN"), async (_, res) => {
  res.json(await couponsWithUsage());
});

couponRouter.patch("/:id", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const payload = couponPayload(req.body);
    // Codes are permanent identifiers because bookings reference them.
    delete payload.code;
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    couponError(res, error);
  }
});

couponRouter.patch(
  "/:id/toggle",
  auth,
  requireRole("ADMIN"),
  async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json(coupon);
  }
);

couponRouter.delete("/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });
  res.json({ message: "Deleted" });
});

couponRouter.post("/validate", async (req, res) => {
  try {
    const coupon = await findValidCoupon(req.body.code, {
      totalAmount: req.body.totalAmount,
    });
    res.json({
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minAmount: coupon.minAmount,
        maxDiscount: coupon.maxDiscount,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        expiresAt: coupon.expiresAt,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
