import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Coupon } from "./coupon.model.js";

export const couponRouter = Router();

couponRouter.post("/", auth, requireRole("ADMIN"), async (req, res) => {
  const coupon = await Coupon.create(req.body);
  res.json(coupon);
});

couponRouter.get("/", auth, requireRole("ADMIN"), async (_, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json(coupons);
});

couponRouter.patch("/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });
  res.json(coupon);
});

couponRouter.patch("/:id/toggle", auth, requireRole("ADMIN"), async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });
  coupon.isActive = !coupon.isActive;
  await coupon.save();
  res.json(coupon);
});

couponRouter.delete("/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });
  res.json({ message: "Deleted" });
});

// validate stays same
couponRouter.post("/validate", async (req, res) => {
  const { code, totalAmount } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) return res.status(400).json({ message: "Invalid coupon" });
  if (coupon.expiresAt && coupon.expiresAt < new Date())
    return res.status(400).json({ message: "Coupon expired" });
  if (coupon.minAmount && totalAmount < coupon.minAmount)
    return res.status(400).json({ message: "Minimum amount not met" });

  res.json({ coupon });
});
